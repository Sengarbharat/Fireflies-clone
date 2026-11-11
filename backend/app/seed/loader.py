"""Load the demo workspace from app/seed/meetings/*.json.

Run manually with `python -m app.seed.loader --reset`, or automatically on
startup when the database is empty (SEED_ON_STARTUP=true).
"""
import argparse
import json
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import Base, SessionLocal, engine, init_db
from ..models import ActionItem, Chapter, Comment, Meeting, Soundbite, Summary, TranscriptSegment
from ..schemas import ParticipantIn
from ..services.meetings import get_current_user, resolve_participants, resolve_tags

SEED_DIR = Path(__file__).parent / "meetings"
TAIL_MS = 6000  # assumed length of the last utterance when the file gives none


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def load_meeting(db: Session, data: dict) -> Meeting:
    user = get_current_user(db)
    started = _parse_dt(data["date"])
    participants = resolve_participants(db, [ParticipantIn(**p) for p in data["participants"]])
    tags = resolve_tags(db, data.get("tags", []))
    meeting = Meeting(
        title=data["title"],
        started_at=started,
        duration_sec=int(data["duration"]),
        platform=data.get("platform", "zoom"),
        source="seed",
        organizer=user,
        participants=participants,
        tags=tags,
    )
    db.add(meeting)

    people = {p.name: p for p in meeting.participants}
    segs = data["segments"]
    for i, s in enumerate(segs):
        start = int(float(s["start"]) * 1000)
        end = int(float(segs[i + 1]["start"]) * 1000) if i + 1 < len(segs) else min(
            start + TAIL_MS, meeting.duration_sec * 1000
        )
        meeting.segments.append(
            TranscriptSegment(position=i, start_ms=start, end_ms=max(end, start + 500),
                              text=s["text"], speaker=people.get(s["speaker"]))
        )

    summ = data.get("summary") or {}
    meeting.summary = Summary(
        overview=summ.get("overview", ""), notes=summ.get("notes", []),
        keywords=summ.get("keywords", []), generated_by="seed", generated_at=started + timedelta(minutes=40),
    )
    meeting.chapters = [
        Chapter(title=c["title"], start_ms=int(float(c["start"]) * 1000), summary=c.get("summary", ""))
        for c in data.get("chapters", [])
    ]
    for a in data.get("action_items", []):
        meeting.action_items.append(
            ActionItem(
                text=a["text"],
                assignee=people.get(a.get("assignee") or ""),
                due_date=date.fromisoformat(a["due_date"]) if a.get("due_date") else None,
                completed=bool(a.get("completed")),
                completed_at=started + timedelta(days=2) if a.get("completed") else None,
                source_start_ms=int(float(a["start"]) * 1000) if a.get("start") is not None else None,
                created_at=started + timedelta(minutes=40),
            )
        )

    # A little collaboration history so soundbites/comments aren't empty.
    if meeting.chapters:
        ch = meeting.chapters[min(1, len(meeting.chapters) - 1)]
        meeting.soundbites.append(
            Soundbite(title=ch.title, start_ms=ch.start_ms, end_ms=ch.start_ms + 45_000, created_by=user,
                      created_at=started + timedelta(hours=2))
        )
    if len(meeting.segments) > 6:
        meeting.segments[6].comments.append(
            Comment(user=user, body="Good point - let's make sure this lands in the follow-up email.",
                    created_at=started + timedelta(hours=3))
        )
    return meeting


def seed(db: Session) -> int:
    files = sorted(SEED_DIR.glob("*.json"))
    for path in files:
        load_meeting(db, json.loads(path.read_text(encoding="utf-8")))
    db.commit()
    return len(files)


def seed_if_empty() -> None:
    init_db()
    with SessionLocal() as db:
        if (db.scalar(select(func.count(Meeting.id))) or 0) == 0:
            seed(db)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the demo workspace")
    parser.add_argument("--reset", action="store_true", help="drop all tables first")
    args = parser.parse_args()
    if args.reset:
        from sqlalchemy import text

        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS segments_fts"))
        Base.metadata.drop_all(engine)
    init_db()
    with SessionLocal() as db:
        print(f"Seeded {seed(db)} meetings")


if __name__ == "__main__":
    main()
