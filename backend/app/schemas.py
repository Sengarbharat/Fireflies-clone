"""Pydantic request/response models: the public API contract."""
from datetime import date, datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field


def _as_utc(value: datetime) -> datetime:
    # SQLite stores datetimes without tz info; everything we write is UTC.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]
Platform = Literal["zoom", "google_meet", "teams", "upload"]
TranscriptFormat = Literal["auto", "txt", "vtt", "srt", "json"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Shared ------------------------------------------------------------------
class UserOut(ORMModel):
    id: int
    name: str
    email: str


class ParticipantOut(ORMModel):
    id: int
    name: str
    email: str | None = None


class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=255)


class TagOut(ORMModel):
    id: int
    name: str
    color: str


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = "violet"


# --- Transcript --------------------------------------------------------------
class CommentOut(ORMModel):
    id: int
    segment_id: int
    body: str
    user: UserOut | None = None
    created_at: UTCDateTime


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class SegmentOut(ORMModel):
    id: int
    position: int
    start_ms: int
    end_ms: int
    text: str
    speaker: ParticipantOut | None = None
    comments: list[CommentOut] = []


class SegmentUpdate(BaseModel):
    text: str = Field(min_length=1)


# --- Summary -----------------------------------------------------------------
class SummaryOut(ORMModel):
    overview: str
    notes: list[str]
    keywords: list[str]
    generated_by: str
    generated_at: UTCDateTime


class ChapterOut(ORMModel):
    id: int
    title: str
    start_ms: int
    summary: str


# --- Action items ------------------------------------------------------------
class ActionItemOut(ORMModel):
    id: int
    meeting_id: int
    text: str
    assignee: ParticipantOut | None = None
    due_date: date | None = None
    completed: bool
    completed_at: UTCDateTime | None = None
    source_start_ms: int | None = None
    created_at: UTCDateTime


class ActionItemWithMeeting(ActionItemOut):
    meeting_title: str
    meeting_started_at: UTCDateTime


class ActionItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    assignee_id: int | None = None
    due_date: date | None = None
    source_start_ms: int | None = Field(default=None, ge=0)


class ActionItemUpdate(BaseModel):
    """Partial update. Only fields present in the request body are applied, so
    `{"assignee_id": null}` clears the assignee while omitting it leaves it."""

    text: str | None = Field(default=None, min_length=1, max_length=2000)
    assignee_id: int | None = None
    due_date: date | None = None
    completed: bool | None = None


# --- Soundbites --------------------------------------------------------------
class SoundbiteOut(ORMModel):
    id: int
    title: str
    start_ms: int
    end_ms: int
    created_at: UTCDateTime


class SoundbiteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)


# --- Meetings ----------------------------------------------------------------
class SpeakerStat(BaseModel):
    participant: ParticipantOut
    talk_ms: int
    talk_pct: float
    segment_count: int


class MeetingListItem(ORMModel):
    id: int
    title: str
    started_at: UTCDateTime
    duration_sec: int
    platform: str
    source: str
    participants: list[ParticipantOut]
    tags: list[TagOut]
    overview: str | None = None
    action_items_total: int = 0
    action_items_open: int = 0


class MeetingList(BaseModel):
    items: list[MeetingListItem]
    total: int
    page: int
    page_size: int


class MeetingDetail(MeetingListItem):
    media_url: str | None = None
    organizer: UserOut | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
    segments: list[SegmentOut]
    summary: SummaryOut | None = None
    chapters: list[ChapterOut]
    action_items: list[ActionItemOut]
    soundbites: list[SoundbiteOut]
    speaker_stats: list[SpeakerStat] = []


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    started_at: datetime | None = None
    platform: Platform = "upload"
    participants: list[ParticipantIn] = []
    tags: list[str] = []
    transcript_text: str | None = None
    transcript_format: TranscriptFormat = "auto"


class BulkDeleteRequest(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)


class BulkDeleteResult(BaseModel):
    deleted: int


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    started_at: datetime | None = None
    platform: Platform | None = None
    participants: list[ParticipantIn] | None = None
    tags: list[str] | None = None


# --- Search & ask ------------------------------------------------------------
class SearchMatch(BaseModel):
    segment_id: int
    start_ms: int
    speaker: str | None
    snippet: str  # contains <mark>...</mark> around matched terms


class SearchResult(BaseModel):
    meeting_id: int
    meeting_title: str
    started_at: UTCDateTime
    title_match: bool
    match_count: int
    matches: list[SearchMatch]


class SearchResponse(BaseModel):
    query: str
    total_meetings: int
    results: list[SearchResult]


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


class Citation(BaseModel):
    segment_id: int
    start_ms: int
    speaker: str | None
    text: str


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    generated_by: Literal["rules", "llm"]
