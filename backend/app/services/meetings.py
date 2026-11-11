"""Meeting domain logic: create/update/list, participant & tag resolution,
transcript ingestion and summary (re)generation. Routers stay thin and call in here."""
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, time, timezone

from fastapi import HTTPException
from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..models import (
    ActionItem,
    Chapter,
    Meeting,
    Participant,
    Summary,
    Tag,
    TranscriptSegment,
    User,
    meeting_participants,
    meeting_tags,
    utcnow,
)
from ..schemas import MeetingCreate, MeetingDetail, MeetingListItem, MeetingUpdate, ParticipantIn, SpeakerStat
from .summarizer import GeneratedNotes, TranscriptLine, generate_notes
from .transcript_parser import ParsedSegment, parse_transcript

DEFAULT_USER = {"name": "Alex Rivera", "email": "alex@northwindlabs.io"}
TAG_COLORS = ["violet", "blue", "emerald", "amber", "rose", "cyan", "fuchsia", "lime"]


# --- lookups -----------------------------------------------------------------
def get_current_user(db: Session) -> User:
    """No real auth (out of scope): everyone is the default workspace user."""
    user = db.scalar(select(User).where(User.email == DEFAULT_USER["email"]))
    if user is None:
        user = User(**DEFAULT_USER)
        db.add(user)
        db.commit()
    return user


def _detail_query() -> Select:
    return select(Meeting).options(
        selectinload(Meeting.participants),
        selectinload(Meeting.tags),
        selectinload(Meeting.summary),
        selectinload(Meeting.chapters),
        selectinload(Meeting.organizer),
        selectinload(Meeting.soundbites),
        selectinload(Meeting.action_items).selectinload(ActionItem.assignee),
        selectinload(Meeting.segments).selectinload(TranscriptSegment.speaker),
        selectinload(Meeting.segments).selectinload(TranscriptSegment.comments),
    )


def get_meeting(db: Session, meeting_id: int) -> Meeting:
    meeting = db.scalar(_detail_query().where(Meeting.id == meeting_id))
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


def resolve_participants(db: Session, people: list[ParticipantIn]) -> list[Participant]:
    """Find-or-create participants; email is the identity when present,
    otherwise a case-insensitive name match."""
    result: list[Participant] = []
    for person in people:
        name = person.name.strip()
        email = (person.email or "").strip().lower() or None
        found = None
        if email:
            found = db.scalar(select(Participant).where(func.lower(Participant.email) == email))
        if found is None:
            found = db.scalar(
                select(Participant).where(func.lower(Participant.name) == name.lower()).order_by(Participant.id)
            )
            if found is not None and email and found.email is None:
                found.email = email
        if found is None:
            found = Participant(name=name, email=email)
            db.add(found)
            db.flush()
        if found not in result:
            result.append(found)
    return result


def resolve_tags(db: Session, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        tag = db.scalar(select(Tag).where(func.lower(Tag.name) == name.lower()))
        if tag is None:
            count = db.scalar(select(func.count(Tag.id))) or 0
            tag = Tag(name=name, color=TAG_COLORS[count % len(TAG_COLORS)])
            db.add(tag)
            db.flush()
        if tag not in tags:
            tags.append(tag)
    return tags


# --- transcript & notes ------------------------------------------------------
def _speaker_lookup(participants: list[Participant]):
    full = {p.name.lower(): p for p in participants}
    first = Counter(p.name.split()[0].lower() for p in participants)
    by_first = {p.name.split()[0].lower(): p for p in participants if first[p.name.split()[0].lower()] == 1}
    return lambda name: full.get(name.lower()) or by_first.get(name.lower())


def attach_transcript(db: Session, meeting: Meeting, parsed: list[ParsedSegment]) -> None:
    """Create segments, mapping speaker labels onto the meeting's participants
    (creating participants for speakers that weren't listed)."""
    lookup = _speaker_lookup(meeting.participants)
    for pos, seg in enumerate(parsed):
        speaker = None
        if seg.speaker:
            speaker = lookup(seg.speaker)
            if speaker is None:
                speaker = resolve_participants(db, [ParticipantIn(name=seg.speaker)])[0]
                meeting.participants.append(speaker)
                lookup = _speaker_lookup(meeting.participants)
        meeting.segments.append(
            TranscriptSegment(position=pos, start_ms=seg.start_ms, end_ms=seg.end_ms, text=seg.text, speaker=speaker)
        )
    if parsed:
        meeting.duration_sec = max(meeting.duration_sec or 0, round(parsed[-1].end_ms / 1000))


def apply_notes(meeting: Meeting, notes: GeneratedNotes, include_action_items: bool) -> None:
    """Replace the summary + outline. Action items are only added on first
    generation so that user edits/completions are never overwritten."""
    if meeting.summary is None:
        meeting.summary = Summary()
    meeting.summary.overview = notes.overview
    meeting.summary.notes = notes.notes
    meeting.summary.keywords = notes.keywords
    meeting.summary.generated_by = notes.generated_by
    meeting.summary.generated_at = utcnow()
    meeting.chapters = [Chapter(title=c.title[:255], start_ms=c.start_ms, summary=c.summary) for c in notes.chapters]
    if include_action_items:
        lookup = _speaker_lookup(meeting.participants)
        for a in notes.action_items:
            meeting.action_items.append(
                ActionItem(text=a.text, assignee=lookup(a.assignee) if a.assignee else None,
                           source_start_ms=a.start_ms)
            )


def generate_for(meeting: Meeting) -> GeneratedNotes:
    lines = [TranscriptLine(s.speaker.name if s.speaker else None, s.start_ms, s.text) for s in meeting.segments]
    return generate_notes(lines, [p.name for p in meeting.participants], meeting.duration_sec * 1000)


# --- commands ----------------------------------------------------------------
def create_meeting(
    db: Session,
    payload: MeetingCreate,
    *,
    source: str = "form",
    filename: str | None = None,
) -> Meeting:
    parsed = (
        parse_transcript(payload.transcript_text, payload.transcript_format, filename)
        if payload.transcript_text and payload.transcript_text.strip()
        else []
    )
    organizer = get_current_user(db)
    participants = resolve_participants(db, payload.participants)
    tags = resolve_tags(db, payload.tags)
    meeting = Meeting(
        title=payload.title.strip(),
        started_at=payload.started_at or utcnow(),
        platform=payload.platform,
        source=source,
        organizer=organizer,
        duration_sec=0,
        participants=participants,
        tags=tags,
    )
    db.add(meeting)
    attach_transcript(db, meeting, parsed)
    if parsed:
        apply_notes(meeting, generate_for(meeting), include_action_items=True)
    db.commit()
    return get_meeting(db, meeting.id)


def update_meeting(db: Session, meeting: Meeting, payload: MeetingUpdate) -> Meeting:
    data = payload.model_dump(exclude_unset=True)
    if data.get("title") is not None:
        meeting.title = data["title"].strip()
    if data.get("started_at") is not None:
        meeting.started_at = data["started_at"]
    if data.get("platform") is not None:
        meeting.platform = data["platform"]
    if payload.participants is not None:
        wanted = resolve_participants(db, payload.participants)
        # Speakers stay attached: removing someone who spoke would orphan lines.
        speakers = {s.speaker_id for s in meeting.segments if s.speaker_id}
        keep = [p for p in meeting.participants if p.id in speakers and p not in wanted]
        meeting.participants = wanted + keep
    if payload.tags is not None:
        meeting.tags = resolve_tags(db, payload.tags)
    meeting.updated_at = utcnow()
    db.commit()
    return get_meeting(db, meeting.id)


def regenerate_summary(db: Session, meeting: Meeting) -> Meeting:
    if not meeting.segments:
        raise HTTPException(status_code=400, detail="This meeting has no transcript to summarize")
    apply_notes(meeting, generate_for(meeting), include_action_items=not meeting.action_items)
    db.commit()
    return get_meeting(db, meeting.id)


# --- queries -----------------------------------------------------------------
def _as_aware(d: datetime) -> datetime:
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d


@dataclass
class MeetingFilters:
    """Library filters; every field is optional and they combine with AND."""

    q: str | None = None  # title, participant name or email
    participant_id: int | None = None
    tag: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    source: str | None = None  # seed | upload | form
    platform: str | None = None  # zoom | google_meet | teams | upload
    min_minutes: int | None = None
    max_minutes: int | None = None

    def conditions(self) -> list:
        out = []
        if self.q:
            like = f"%{self.q.strip().lower()}%"
            people_match = select(meeting_participants.c.meeting_id).join(
                Participant, Participant.id == meeting_participants.c.participant_id
            ).where(or_(func.lower(Participant.name).like(like), func.lower(Participant.email).like(like)))
            out.append(or_(func.lower(Meeting.title).like(like), Meeting.id.in_(people_match)))
        if self.participant_id:
            out.append(
                Meeting.id.in_(select(meeting_participants.c.meeting_id).where(
                    meeting_participants.c.participant_id == self.participant_id))
            )
        if self.tag:
            out.append(
                Meeting.id.in_(
                    select(meeting_tags.c.meeting_id).join(Tag, Tag.id == meeting_tags.c.tag_id)
                    .where(func.lower(Tag.name) == self.tag.lower())
                )
            )
        if self.date_from:
            out.append(Meeting.started_at >= datetime.combine(self.date_from, time.min))
        if self.date_to:
            out.append(Meeting.started_at <= datetime.combine(self.date_to, time.max))
        if self.source:
            out.append(Meeting.source == self.source)
        if self.platform:
            out.append(Meeting.platform == self.platform)
        if self.min_minutes is not None:
            out.append(Meeting.duration_sec >= self.min_minutes * 60)
        if self.max_minutes is not None:
            out.append(Meeting.duration_sec < self.max_minutes * 60)
        return out


def list_meetings(
    db: Session,
    filters: MeetingFilters,
    *,
    sort: str,
    page: int,
    page_size: int,
) -> tuple[list[MeetingListItem], int]:
    conditions = filters.conditions()
    where = and_(*conditions) if conditions else True
    total = db.scalar(select(func.count(Meeting.id)).where(where)) or 0

    order = {
        "recent": Meeting.started_at.desc(),
        "oldest": Meeting.started_at.asc(),
        "longest": Meeting.duration_sec.desc(),
        "title": func.lower(Meeting.title).asc(),
    }.get(sort, Meeting.started_at.desc())

    ai_counts = (
        select(
            ActionItem.meeting_id,
            func.count(ActionItem.id).label("total"),
            func.sum(case((ActionItem.completed.is_(False), 1), else_=0)).label("open"),
        )
        .group_by(ActionItem.meeting_id)
        .subquery()
    )
    rows = db.execute(
        select(Meeting, ai_counts.c.total, ai_counts.c.open)
        .outerjoin(ai_counts, ai_counts.c.meeting_id == Meeting.id)
        .where(where)
        .options(selectinload(Meeting.participants), selectinload(Meeting.tags), selectinload(Meeting.summary))
        .order_by(order, Meeting.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []
    for meeting, total_ai, open_ai in rows:
        item = MeetingListItem.model_validate(meeting)
        item.overview = meeting.summary.overview if meeting.summary else None
        item.action_items_total = total_ai or 0
        item.action_items_open = open_ai or 0
        items.append(item)
    return items, total


def to_detail(meeting: Meeting) -> MeetingDetail:
    detail = MeetingDetail.model_validate(meeting)
    detail.overview = meeting.summary.overview if meeting.summary else None
    detail.action_items_total = len(meeting.action_items)
    detail.action_items_open = sum(1 for a in meeting.action_items if not a.completed)

    talk: Counter[int] = Counter()
    count: Counter[int] = Counter()
    people = {}
    for seg in meeting.segments:
        if seg.speaker:
            talk[seg.speaker.id] += max(0, seg.end_ms - seg.start_ms)
            count[seg.speaker.id] += 1
            people[seg.speaker.id] = seg.speaker
    total = sum(talk.values()) or 1
    detail.speaker_stats = [
        SpeakerStat(participant=people[pid], talk_ms=ms, talk_pct=round(100 * ms / total, 1), segment_count=count[pid])
        for pid, ms in talk.most_common()
    ]
    return detail
