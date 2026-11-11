"use client";

import { Link2, MessageSquare, Scissors, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatTimestamp, relativeTime, textColorFor } from "@/lib/format";
import type { Segment } from "@/lib/types";

interface Props {
  segment: Segment;
  active: boolean;
  regex: RegExp | null;
  firstMatchIndex: number;
  currentMatch: number;
  onSeek: (ms: number) => void;
  onComment: (segmentId: number, body: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
  onSoundbite: (segment: Segment) => void;
  onCopyLink: (segment: Segment) => void;
  editable?: boolean;
  onEditText?: (segmentId: number, text: string) => Promise<void>;
}

/** Splits text on the search regex and wraps hits in <mark>. */
function Highlighted({ text, regex, first, current }: { text: string; regex: RegExp | null; first: number; current: number }) {
  if (!regex) return <>{text}</>;
  const parts = text.split(regex);
  let n = first;
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const idx = n++;
        return (
          <mark key={i} data-match={idx} className={idx === current ? "current" : undefined}>
            {part}
          </mark>
        );
      })}
    </>
  );
}

function TranscriptLineImpl({
  segment,
  active,
  regex,
  firstMatchIndex,
  currentMatch,
  onSeek,
  onComment,
  onDeleteComment,
  onSoundbite,
  onCopyLink,
  editable,
  onEditText,
}: Props) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const name = segment.speaker?.name ?? "Unknown speaker";

  return (
    <div
      id={`seg-${segment.id}`}
      data-active={active || undefined}
      className={cn(
        "group relative flex gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-black/[0.025] dark:hover:bg-white/[0.03]",
      )}
    >
      {active && <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-brand-500" />}
      <Avatar name={name} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", textColorFor(name))}>{name}</span>
          <button
            onClick={() => onSeek(segment.start_ms)}
            className="font-mono text-[11px] text-muted hover:text-brand-600 hover:underline"
            title="Play from here"
          >
            {formatTimestamp(segment.start_ms)}
          </button>
          <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {[
              { icon: MessageSquare, label: "Comment", fn: () => setComposing(true) },
              { icon: Scissors, label: "Create soundbite", fn: () => onSoundbite(segment) },
              { icon: Link2, label: "Copy link to this moment", fn: () => onCopyLink(segment) },
            ].map(({ icon: Icon, label, fn }) => (
              <button key={label} onClick={fn} title={label} aria-label={label} className="rounded p-1 text-muted hover:bg-black/5 hover:text-current dark:hover:bg-white/10">
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
        {editable ? (
          <textarea
            defaultValue={segment.text}
            rows={Math.max(2, Math.ceil(segment.text.length / 60))}
            onBlur={(e) => {
              const text = e.target.value.trim();
              if (text && text !== segment.text) void onEditText?.(segment.id, text);
              else e.target.value = segment.text;
            }}
            aria-label={`Edit line at ${formatTimestamp(segment.start_ms)}`}
            className="mt-1 w-full resize-y rounded-lg border bg-surface px-2 py-1.5 text-sm leading-relaxed outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/20"
          />
        ) : (
          <p onClick={() => onSeek(segment.start_ms)} className="mt-0.5 cursor-pointer text-sm leading-relaxed">
            <Highlighted text={segment.text} regex={regex} first={firstMatchIndex} current={currentMatch} />
          </p>
        )}

        {segment.comments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {segment.comments.map((c) => (
              <div key={c.id} className="group/c flex items-start gap-2 rounded-lg border-l-2 border-amber-400 bg-amber-50/70 px-2.5 py-1.5 text-xs dark:bg-amber-500/10">
                <span className="font-semibold">{c.user?.name ?? "You"}</span>
                <span className="flex-1">{c.body}</span>
                <span className="text-muted">{relativeTime(c.created_at)}</span>
                <button onClick={() => onDeleteComment(c.id)} aria-label="Delete comment" className="text-muted opacity-0 hover:text-rose-600 group-hover/c:opacity-100">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {composing && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              await onComment(segment.id, draft.trim());
              setDraft("");
              setComposing(false);
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setComposing(false)}
              placeholder="Add a comment..."
              className="h-8 flex-1 rounded-lg border bg-surface px-2.5 text-xs outline-none focus:border-brand-400"
            />
            <button type="submit" className="rounded-lg bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700">
              Comment
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export const TranscriptLine = memo(TranscriptLineImpl);
