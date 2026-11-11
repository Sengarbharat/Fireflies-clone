"""Global search across meeting titles and transcript text.

Transcript matches come from the FTS5 index (`segments_fts`, ranked with bm25
and highlighted with snippet()). If the query cannot be expressed in FTS
syntax, or FTS5 is unavailable, it falls back to a LIKE scan.
"""
import html
import re

from sqlalchemy import func, select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from ..models import Meeting, Participant, TranscriptSegment
from ..schemas import SearchMatch, SearchResponse, SearchResult

MAX_MATCHES_PER_MEETING = 5


def _fts_query(q: str) -> str | None:
    """Turn free text into a safe FTS5 query: every term must match, the last
    term as a prefix (search-as-you-type)."""
    terms = re.findall(r"[\w']+", q.lower())
    if not terms:
        return None
    quoted = [f'"{t}"' for t in terms]
    quoted[-1] += "*"
    return " AND ".join(quoted)


def _like_snippet(body: str, q: str, radius: int = 70) -> str:
    idx = body.lower().find(q.lower())
    start, end = max(0, idx - radius), min(len(body), idx + len(q) + radius)
    pre, hit, post = body[start:idx], body[idx:idx + len(q)], body[idx + len(q):end]
    return (
        ("..." if start else "") + html.escape(pre) + "<mark>" + html.escape(hit) + "</mark>"
        + html.escape(post) + ("..." if end < len(body) else "")
    )


def _segment_hits(db: Session, q: str) -> list[tuple[int, int, int, str | None, str]]:
    """Return (meeting_id, segment_id, start_ms, speaker, snippet) best-first."""
    fts = _fts_query(q)
    if fts:
        try:
            # snippet() output is built from stored text; escape it, then turn
            # the sentinel markers back into <mark> tags.
            rows = db.execute(
                text(
                    """
                    SELECT s.meeting_id, s.id, s.start_ms, p.name,
                           snippet(segments_fts, 0, '\x02', '\x03', '...', 18) AS snip
                    FROM segments_fts
                    JOIN transcript_segments s ON s.id = segments_fts.rowid
                    LEFT JOIN participants p ON p.id = s.speaker_id
                    WHERE segments_fts MATCH :q
                    ORDER BY bm25(segments_fts)
                    LIMIT 500
                    """
                ),
                {"q": fts},
            ).all()
            return [
                (r[0], r[1], r[2], r[3],
                 html.escape(r[4]).replace("\x02", "<mark>").replace("\x03", "</mark>"))
                for r in rows
            ]
        except OperationalError:
            pass  # FTS unavailable or query rejected: use LIKE below
    rows = db.execute(
        select(TranscriptSegment.meeting_id, TranscriptSegment.id, TranscriptSegment.start_ms,
               Participant.name, TranscriptSegment.text)
        .outerjoin(Participant, Participant.id == TranscriptSegment.speaker_id)
        .where(TranscriptSegment.text.ilike(f"%{q}%"))
        .order_by(TranscriptSegment.meeting_id, TranscriptSegment.start_ms)
        .limit(500)
    ).all()
    return [(r[0], r[1], r[2], r[3], _like_snippet(r[4], q)) for r in rows]


def search_meetings(db: Session, q: str, limit: int = 20) -> SearchResponse:
    q = q.strip()
    if not q:
        return SearchResponse(query=q, total_meetings=0, results=[])

    grouped: dict[int, list[SearchMatch]] = {}
    counts: dict[int, int] = {}
    for meeting_id, seg_id, start_ms, speaker, snip in _segment_hits(db, q):
        counts[meeting_id] = counts.get(meeting_id, 0) + 1
        bucket = grouped.setdefault(meeting_id, [])
        if len(bucket) < MAX_MATCHES_PER_MEETING:
            bucket.append(SearchMatch(segment_id=seg_id, start_ms=start_ms, speaker=speaker, snippet=snip))

    title_ids = set(
        db.scalars(select(Meeting.id).where(func.lower(Meeting.title).contains(q.lower()))).all()
    )
    ids = list(dict.fromkeys([*title_ids, *grouped.keys()]))  # title hits first, then by rank
    meetings = {m.id: m for m in db.scalars(select(Meeting).where(Meeting.id.in_(ids))).all()}

    results = [
        SearchResult(
            meeting_id=mid,
            meeting_title=meetings[mid].title,
            started_at=meetings[mid].started_at,
            title_match=mid in title_ids,
            match_count=counts.get(mid, 0),
            matches=sorted(grouped.get(mid, []), key=lambda m: m.start_ms),
        )
        for mid in ids
        if mid in meetings
    ]
    return SearchResponse(query=q, total_meetings=len(results), results=results[:limit])
