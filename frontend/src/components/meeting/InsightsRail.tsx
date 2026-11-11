"use client";

import { CalendarClock, Hash, ListChecks, MessageSquare, PlayCircle, Scissors, Trash2, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatTimestamp, hexColorFor } from "@/lib/format";
import type { MeetingDetail } from "@/lib/types";
import { countSmart, SMART_FILTERS, type SmartFilter } from "./filters";

const SMART_ICONS: Record<SmartFilter, typeof Hash> = {
  questions: Hash,
  tasks: ListChecks,
  metrics: TrendingUp,
  dates: CalendarClock,
};

/** Left rail: speaker talk-time, smart transcript filters and soundbites. */
export function InsightsRail({
  meeting,
  speakerFilter,
  onSpeaker,
  smartFilter,
  onSmart,
  onJump,
  onDeleteSoundbite,
}: {
  meeting: MeetingDetail;
  speakerFilter: number | null;
  onSpeaker: (id: number | null) => void;
  smartFilter: SmartFilter | null;
  onSmart: (f: SmartFilter | null) => void;
  onJump: (ms: number) => void;
  onDeleteSoundbite: (id: number) => void;
}) {
  const counts = useMemo(
    () => Object.fromEntries((Object.keys(SMART_FILTERS) as SmartFilter[]).map((k) => [k, countSmart(meeting.segments, k)])),
    [meeting.segments],
  ) as Record<SmartFilter, number>;
  const comments = useMemo(
    () => meeting.segments.flatMap((s) => s.comments.map((comment) => ({ comment, startMs: s.start_ms }))),
    [meeting.segments],
  );

  const heading = "mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted";

  return (
    <div className="space-y-6 px-3 py-4">
      <div>
        <h3 className={heading}>Smart filters</h3>
        <div className="space-y-0.5">
          {(Object.keys(SMART_FILTERS) as SmartFilter[]).map((k) => {
            const Icon = SMART_ICONS[k];
            const active = smartFilter === k;
            return (
              <button
                key={k}
                onClick={() => onSmart(active ? null : k)}
                disabled={!counts[k]}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors disabled:opacity-40",
                  active ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "hover:bg-black/[0.04] dark:hover:bg-white/5",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">{SMART_FILTERS[k].label}</span>
                <span className="text-xs text-muted">{counts[k]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className={heading}>Speakers</h3>
        <div className="space-y-1">
          {meeting.speaker_stats.map((s) => {
            const active = speakerFilter === s.participant.id;
            return (
              <button
                key={s.participant.id}
                onClick={() => onSpeaker(active ? null : s.participant.id)}
                className={cn(
                  "w-full rounded-lg px-2 py-1.5 text-left transition-colors",
                  active ? "bg-brand-50 dark:bg-brand-500/15" : "hover:bg-black/[0.04] dark:hover:bg-white/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <Avatar name={s.participant.name} size="xs" />
                  <span className="flex-1 truncate text-sm">{s.participant.name}</span>
                  <span className="text-xs tabular-nums text-muted">{Math.round(s.talk_pct)}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${s.talk_pct}%`, background: hexColorFor(s.participant.name) }} />
                </div>
              </button>
            );
          })}
          {meeting.speaker_stats.length === 0 && <p className="px-1 text-xs text-muted">No speakers detected.</p>}
        </div>
      </div>

      <div>
        <h3 className={heading}>Comments</h3>
        {comments.length === 0 ? (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
            <MessageSquare className="h-3 w-3" /> Hover a transcript line to comment.
          </p>
        ) : (
          <div className="space-y-1">
            {comments.map(({ comment, startMs }) => (
              <button
                key={comment.id}
                onClick={() => onJump(startMs)}
                className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="font-mono text-brand-600">{formatTimestamp(startMs)}</span>
                  {comment.user?.name ?? "You"}
                </span>
                <span className="line-clamp-2 text-xs">{comment.body}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className={heading}>Soundbites</h3>
        {meeting.soundbites.length === 0 ? (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
            <Scissors className="h-3 w-3" /> Hover a transcript line to clip it.
          </p>
        ) : (
          <div className="space-y-1">
            {meeting.soundbites.map((b) => (
              <div key={b.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/5">
                <button onClick={() => onJump(b.start_ms)} className="flex min-w-0 flex-1 items-center gap-2 text-left" title="Play soundbite">
                  <PlayCircle className="h-4 w-4 shrink-0 text-brand-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{b.title}</span>
                    <span className="font-mono text-[10px] text-muted">
                      {formatTimestamp(b.start_ms)} - {formatTimestamp(b.end_ms)}
                    </span>
                  </span>
                </button>
                <button onClick={() => onDeleteSoundbite(b.id)} aria-label="Delete soundbite" className="text-muted opacity-0 hover:text-rose-600 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
