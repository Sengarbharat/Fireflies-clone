"""Top-level resources that are addressed by their own id: action items,
transcript segments, comments, soundbites, plus workspace lookups
(current user, participants, tags) and global search."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    ActionItem,
    Comment,
    Meeting,
    Participant,
    Soundbite,
    Tag,
    TranscriptSegment,
    meeting_participants,
    meeting_tags,
    utcnow,
)
from ..schemas import (
    ActionItemOut,
    ActionItemUpdate,
    ActionItemWithMeeting,
    CommentCreate,
    CommentOut,
    ParticipantOut,
    SearchResponse,
    SegmentOut,
    SegmentUpdate,
    TagCreate,
    TagOut,
    UserOut,
)
from ..services.meetings import TAG_COLORS, get_current_user
from ..services.search import search_meetings

router = APIRouter(prefix="/api")


def _get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


# --- workspace ---------------------------------------------------------------
@router.get("/me", response_model=UserOut, tags=["workspace"])
def me(db: Session = Depends(get_db)):
    return get_current_user(db)


@router.get("/participants", response_model=list[ParticipantOut], tags=["workspace"])
def participants(db: Session = Depends(get_db)):
    """People who attend at least one meeting (filter and assignee pickers).
    Rows left behind by deleted meetings are kept for reuse but not listed."""
    in_meetings = select(meeting_participants.c.participant_id)
    return db.scalars(
        select(Participant).where(Participant.id.in_(in_meetings)).order_by(Participant.name)
    ).all()


@router.get("/tags", response_model=list[TagOut], tags=["workspace"])
def tags(db: Session = Depends(get_db)):
    used = select(meeting_tags.c.tag_id)
    return db.scalars(select(Tag).where(Tag.id.in_(used)).order_by(Tag.name)).all()


@router.post("/tags", response_model=TagOut, status_code=status.HTTP_201_CREATED, tags=["workspace"])
def create_tag(payload: TagCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Tag).where(func.lower(Tag.name) == payload.name.strip().lower())):
        raise HTTPException(status_code=409, detail="Tag already exists")
    color = payload.color if payload.color in TAG_COLORS else "violet"
    tag = Tag(name=payload.name.strip(), color=color)
    db.add(tag)
    db.commit()
    return tag


@router.get("/search", response_model=SearchResponse, tags=["search"])
def search(q: str = Query(..., min_length=1, max_length=200), limit: int = Query(20, ge=1, le=50),
           db: Session = Depends(get_db)):
    return search_meetings(db, q, limit)


# --- action items ------------------------------------------------------------
@router.get("/action-items", response_model=list[ActionItemWithMeeting], tags=["action items"])
def all_action_items(
    completed: bool | None = None,
    assignee_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Cross-meeting task list (the "Tasks" page)."""
    stmt = (
        select(ActionItem, Meeting.title, Meeting.started_at)
        .join(Meeting, Meeting.id == ActionItem.meeting_id)
        .options(selectinload(ActionItem.assignee))
        .order_by(ActionItem.completed, ActionItem.due_date.is_(None), ActionItem.due_date, Meeting.started_at.desc())
    )
    if completed is not None:
        stmt = stmt.where(ActionItem.completed.is_(completed))
    if assignee_id is not None:
        stmt = stmt.where(ActionItem.assignee_id == assignee_id)
    return [
        ActionItemWithMeeting(**ActionItemOut.model_validate(item).model_dump(), meeting_title=title,
                              meeting_started_at=started)
        for item, title, started in db.execute(stmt).all()
    ]


@router.patch("/action-items/{item_id}", response_model=ActionItemOut, tags=["action items"])
def update_action_item(item_id: int, payload: ActionItemUpdate, db: Session = Depends(get_db)):
    item = _get_or_404(db, ActionItem, item_id, "Action item")
    data = payload.model_dump(exclude_unset=True)
    if "assignee_id" in data and data["assignee_id"] is not None:
        meeting = db.get(Meeting, item.meeting_id)
        if data["assignee_id"] not in {p.id for p in meeting.participants}:
            raise HTTPException(status_code=422, detail="Assignee must be a participant of this meeting")
    if data.get("text") is None:
        data.pop("text", None)
    if "completed" in data:
        if data["completed"] is None:
            data.pop("completed")
        elif data["completed"] != item.completed:
            item.completed_at = utcnow() if data["completed"] else None
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/action-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["action items"])
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, ActionItem, item_id, "Action item"))
    db.commit()


# --- transcript segments & comments ------------------------------------------
@router.patch("/segments/{segment_id}", response_model=SegmentOut, tags=["transcript"])
def update_segment(segment_id: int, payload: SegmentUpdate, db: Session = Depends(get_db)):
    """Fix a transcription mistake. The FTS index is kept in sync by trigger."""
    seg = _get_or_404(db, TranscriptSegment, segment_id, "Segment")
    seg.text = payload.text.strip()
    db.commit()
    db.refresh(seg)
    return seg


@router.post("/segments/{segment_id}/comments", response_model=CommentOut,
             status_code=status.HTTP_201_CREATED, tags=["transcript"])
def add_comment(segment_id: int, payload: CommentCreate, db: Session = Depends(get_db)):
    _get_or_404(db, TranscriptSegment, segment_id, "Segment")
    comment = Comment(segment_id=segment_id, body=payload.body.strip(), user=get_current_user(db))
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["transcript"])
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, Comment, comment_id, "Comment"))
    db.commit()


@router.delete("/soundbites/{soundbite_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["soundbites"])
def delete_soundbite(soundbite_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, Soundbite, soundbite_id, "Soundbite"))
    db.commit()
