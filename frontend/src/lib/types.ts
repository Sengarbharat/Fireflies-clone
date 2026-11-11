// Mirrors backend/app/schemas.py. Times inside a recording are milliseconds.

export type Platform = "zoom" | "google_meet" | "teams" | "upload";

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Participant {
  id: number;
  name: string;
  email: string | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Comment {
  id: number;
  segment_id: number;
  body: string;
  user: User | null;
  created_at: string;
}

export interface Segment {
  id: number;
  position: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: Participant | null;
  comments: Comment[];
}

export interface Summary {
  overview: string;
  notes: string[];
  keywords: string[];
  generated_by: "seed" | "rules" | "llm" | string;
  generated_at: string;
}

export interface Chapter {
  id: number;
  title: string;
  start_ms: number;
  summary: string;
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  text: string;
  assignee: Participant | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  source_start_ms: number | null;
  created_at: string;
}

export interface ActionItemWithMeeting extends ActionItem {
  meeting_title: string;
  meeting_started_at: string;
}

export interface Soundbite {
  id: number;
  title: string;
  start_ms: number;
  end_ms: number;
  created_at: string;
}

export interface SpeakerStat {
  participant: Participant;
  talk_ms: number;
  talk_pct: number;
  segment_count: number;
}

export interface MeetingListItem {
  id: number;
  title: string;
  started_at: string;
  duration_sec: number;
  platform: Platform;
  source: "seed" | "upload" | "form";
  participants: Participant[];
  tags: Tag[];
  overview: string | null;
  action_items_total: number;
  action_items_open: number;
}

export interface MeetingList {
  items: MeetingListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface MeetingDetail extends MeetingListItem {
  media_url: string | null;
  organizer: User | null;
  created_at: string;
  updated_at: string;
  segments: Segment[];
  summary: Summary | null;
  chapters: Chapter[];
  action_items: ActionItem[];
  soundbites: Soundbite[];
  speaker_stats: SpeakerStat[];
}

export interface SearchMatch {
  segment_id: number;
  start_ms: number;
  speaker: string | null;
  snippet: string;
}

export interface SearchResult {
  meeting_id: number;
  meeting_title: string;
  started_at: string;
  title_match: boolean;
  match_count: number;
  matches: SearchMatch[];
}

export interface SearchResponse {
  query: string;
  total_meetings: number;
  results: SearchResult[];
}

export interface Citation {
  segment_id: number;
  start_ms: number;
  speaker: string | null;
  text: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  generated_by: "rules" | "llm";
}

export interface ParticipantInput {
  name: string;
  email?: string | null;
}
