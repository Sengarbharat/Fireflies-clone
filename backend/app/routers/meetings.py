"""/api/meetings - meeting CRUD plus per-meeting sub-resources."""
from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ActionItem, Meeting, Soundbite
from ..schemas import (
    ActionItemCreate,
    ActionItemOut,
    AskRequest,
    AskResponse,
    BulkDeleteRequest,
    BulkDeleteResult,
    MeetingCreate,
    MeetingDetail,
    MeetingList,
    MeetingUpdate,
    ParticipantIn,
    Platform,
    SoundbiteCreate,
    SoundbiteOut,
)
from ..services import exporter, meetings as svc
from ..services.qa import answer_question
from ..services.transcript_parser import TranscriptParseError

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

MAX_UPLOAD_BYTES = 2 * 1024 * 1024


@router.get("", response_model=MeetingList)
def list_meetings(
    q: str | None = Query(None, description="Matches title or participant name/email"),
    participant_id: int | None = None,
    tag: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    source: Literal["seed", "upload", "form"] | None = None,
    platform: Platform | None = None,
    min_minutes: int | None = Query(None, ge=0, description="Duration lower bound (inclusive)"),
    max_minutes: int | None = Query(None, ge=1, description="Duration upper bound (exclusive)"),
    sort: Literal["recent", "oldest", "longest", "title"] = "recent",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    filters = svc.MeetingFilters(
        q=q, participant_id=participant_id, tag=tag, date_from=date_from, date_to=date_to,
        source=source, platform=platform, min_minutes=min_minutes, max_minutes=max_minutes,
    )
    items, total = svc.list_meetings(db, filters, sort=sort, page=page, page_size=page_size)
    return MeetingList(items=items, total=total, page=page, page_size=page_size)


@router.post("/bulk-delete", response_model=BulkDeleteResult)
def bulk_delete(payload: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Delete several meetings at once (library multi-select)."""
    meetings = db.scalars(select(Meeting).where(Meeting.id.in_(payload.ids))).all()
    for meeting in meetings:
        db.delete(meeting)
    db.commit()
    return BulkDeleteResult(deleted=len(meetings))


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def create_meeting(payload: MeetingCreate, db: Session = Depends(get_db)):
    try:
        meeting = svc.create_meeting(db, payload, source="upload" if payload.transcript_text else "form")
    except TranscriptParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return svc.to_detail(meeting)


@router.post("/upload", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
async def upload_transcript(
    file: UploadFile = File(..., description=".txt, .vtt, .srt or .json transcript"),
    title: str | None = Form(None),
    started_at: datetime | None = Form(None),
    platform: Platform = Form("upload"),
    participants: str = Form("", description="Comma-separated names"),
    tags: str = Form("", description="Comma-separated tag names"),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Transcript files are limited to 2 MB")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="Transcript must be UTF-8 text") from exc
    if not text.strip():
        raise HTTPException(status_code=422, detail="The uploaded transcript is empty")

    default_title = (file.filename or "Uploaded meeting").rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()
    payload = MeetingCreate(
        title=(title or default_title)[:255],
        started_at=started_at,
        platform=platform,
        participants=[ParticipantIn(name=n.strip()) for n in participants.split(",") if n.strip()],
        tags=[t.strip() for t in tags.split(",") if t.strip()],
        transcript_text=text,
        transcript_format="auto",
    )
    try:
        meeting = svc.create_meeting(db, payload, source="upload", filename=file.filename)
    except TranscriptParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return svc.to_detail(meeting)


@router.get("/{meeting_id}", response_model=MeetingDetail)
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    return svc.to_detail(svc.get_meeting(db, meeting_id))


@router.patch("/{meeting_id}", response_model=MeetingDetail)
def update_meeting(meeting_id: int, payload: MeetingUpdate, db: Session = Depends(get_db)):
    meeting = svc.update_meeting(db, svc.get_meeting(db, meeting_id), payload)
    return svc.to_detail(meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    db.delete(svc.get_meeting(db, meeting_id))
    db.commit()


@router.post("/{meeting_id}/summary/regenerate", response_model=MeetingDetail)
def regenerate_summary(meeting_id: int, db: Session = Depends(get_db)):
    return svc.to_detail(svc.regenerate_summary(db, svc.get_meeting(db, meeting_id)))


@router.post("/{meeting_id}/ask", response_model=AskResponse)
def ask(meeting_id: int, payload: AskRequest, db: Session = Depends(get_db)):
    return answer_question(svc.get_meeting(db, meeting_id), payload.question)


@router.get("/{meeting_id}/export")
def export(meeting_id: int, format: Literal["md", "txt"] = "md", db: Session = Depends(get_db)):
    meeting = svc.get_meeting(db, meeting_id)
    body = exporter.to_markdown(meeting) if format == "md" else exporter.to_text(meeting)
    slug = "".join(c if c.isalnum() else "-" for c in meeting.title.lower()).strip("-")[:60] or "meeting"
    media = "text/markdown" if format == "md" else "text/plain"
    return Response(
        content=body, media_type=f"{media}; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{slug}.{format}"'},
    )


@router.post("/{meeting_id}/action-items", response_model=ActionItemOut, status_code=status.HTTP_201_CREATED)
def create_action_item(meeting_id: int, payload: ActionItemCreate, db: Session = Depends(get_db)):
    meeting = svc.get_meeting(db, meeting_id)
    if payload.assignee_id and payload.assignee_id not in {p.id for p in meeting.participants}:
        raise HTTPException(status_code=422, detail="Assignee must be a participant of this meeting")
    item = ActionItem(meeting_id=meeting.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/{meeting_id}/soundbites", response_model=SoundbiteOut, status_code=status.HTTP_201_CREATED)
def create_soundbite(meeting_id: int, payload: SoundbiteCreate, db: Session = Depends(get_db)):
    meeting = svc.get_meeting(db, meeting_id)
    if payload.end_ms <= payload.start_ms:
        raise HTTPException(status_code=422, detail="end_ms must be after start_ms")
    bite = Soundbite(meeting_id=meeting.id, created_by=svc.get_current_user(db), **payload.model_dump())
    db.add(bite)
    db.commit()
    db.refresh(bite)
    return bite
