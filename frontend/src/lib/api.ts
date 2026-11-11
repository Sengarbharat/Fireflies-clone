import type {
  ActionItem,
  AskResponse,
  Comment,
  MeetingDetail,
  ParticipantInput,
  Platform,
  Soundbite,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** SWR fetcher: keys are API paths. */
export const fetcher = <T,>(path: string) => request<T>(path);

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  createMeeting: (body: {
    title: string;
    started_at?: string | null;
    platform?: Platform;
    participants?: ParticipantInput[];
    tags?: string[];
    transcript_text?: string | null;
  }) => request<MeetingDetail>("/api/meetings", { method: "POST", body: json(body) }),

  uploadTranscript: (form: FormData) =>
    request<MeetingDetail>("/api/meetings/upload", { method: "POST", body: form }),

  updateMeeting: (
    id: number,
    body: Partial<{ title: string; started_at: string; participants: ParticipantInput[]; tags: string[] }>,
  ) => request<MeetingDetail>(`/api/meetings/${id}`, { method: "PATCH", body: json(body) }),

  deleteMeeting: (id: number) => request<void>(`/api/meetings/${id}`, { method: "DELETE" }),

  bulkDelete: (ids: number[]) =>
    request<{ deleted: number }>("/api/meetings/bulk-delete", { method: "POST", body: json({ ids }) }),

  regenerateSummary: (id: number) =>
    request<MeetingDetail>(`/api/meetings/${id}/summary/regenerate`, { method: "POST" }),

  ask: (id: number, question: string) =>
    request<AskResponse>(`/api/meetings/${id}/ask`, { method: "POST", body: json({ question }) }),

  exportUrl: (id: number, format: "md" | "txt") => `${API_URL}/api/meetings/${id}/export?format=${format}`,

  createActionItem: (
    meetingId: number,
    body: { text: string; assignee_id?: number | null; due_date?: string | null; source_start_ms?: number | null },
  ) => request<ActionItem>(`/api/meetings/${meetingId}/action-items`, { method: "POST", body: json(body) }),

  updateActionItem: (
    id: number,
    body: Partial<{ text: string; assignee_id: number | null; due_date: string | null; completed: boolean }>,
  ) => request<ActionItem>(`/api/action-items/${id}`, { method: "PATCH", body: json(body) }),

  deleteActionItem: (id: number) => request<void>(`/api/action-items/${id}`, { method: "DELETE" }),

  updateSegment: (segmentId: number, text: string) =>
    request<unknown>(`/api/segments/${segmentId}`, { method: "PATCH", body: json({ text }) }),

  addComment: (segmentId: number, body: string) =>
    request<Comment>(`/api/segments/${segmentId}/comments`, { method: "POST", body: json({ body }) }),

  deleteComment: (id: number) => request<void>(`/api/comments/${id}`, { method: "DELETE" }),

  createSoundbite: (meetingId: number, body: { title: string; start_ms: number; end_ms: number }) =>
    request<Soundbite>(`/api/meetings/${meetingId}/soundbites`, { method: "POST", body: json(body) }),

  deleteSoundbite: (id: number) => request<void>(`/api/soundbites/${id}`, { method: "DELETE" }),
};
