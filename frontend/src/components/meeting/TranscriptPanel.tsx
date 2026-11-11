"use client";

import { Check, ChevronDown, ChevronUp, LocateFixed, Pencil, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, escapeRegExp } from "@/lib/format";
import type { MeetingDetail, Segment } from "@/lib/types";
import { SMART_FILTERS, type SmartFilter } from "./filters";
import { TranscriptLine } from "./TranscriptLine";

interface Props {
  meeting: MeetingDetail;
  activeSegmentId: number | null;
  playing: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  speakerFilter: number | null;
  onClearSpeaker: () => void;
  smartFilter: SmartFilter | null;
  onClearSmart: () => void;
  onSeek: (ms: number) => void;
  onComment: (segmentId: number, body: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
  onSoundbite: (s: Segment) => void;
  onCopyLink: (s: Segment) => void;
  onEditText: (segmentId: number, text: string) => Promise<void>;
}

export function TranscriptPanel(props: Props) {
  const { meeting, activeSegmentId, playing, query, speakerFilter, smartFilter } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [follow, setFollow] = useState(true);
  const [editing, setEditing] = useState(false);
  const programmaticScroll = useRef(false);

  const visible = useMemo(
    () =>
      meeting.segments.filter(
        (s) =>
          (speakerFilter === null || s.speaker?.id === speakerFilter) &&
          (smartFilter === null || SMART_FILTERS[smartFilter].test(s.text)),
      ),
    [meeting.segments, speakerFilter, smartFilter],
  );

  // Search: one capturing regex, a running match index per line.
  const regex = useMemo(() => (query.trim().length >= 2 ? new RegExp(`(${escapeRegExp(query.trim())})`, "gi") : null), [query]);
  const { firstIndex, total } = useMemo(() => {
    const firstIndex = new Map<number, number>();
    let total = 0;
    if (regex) {
      for (const s of visible) {
        firstIndex.set(s.id, total);
        total += (s.text.match(regex) ?? []).length;
      }
    }
    return { firstIndex, total };
  }, [visible, regex]);

  useEffect(() => {
    setCurrent(0);
  }, [query, speakerFilter, smartFilter]);

  const scrollToEl = useCallback((el: Element | null) => {
    if (!el) return;
    programmaticScroll.current = true;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => (programmaticScroll.current = false), 600);
  }, []);

  // Jump to the current search hit.
  useEffect(() => {
    if (total > 0) scrollToEl(scrollRef.current?.querySelector(`mark[data-match="${current}"]`) ?? null);
  }, [current, total, scrollToEl]);

  // Follow playback (pauses when the user scrolls manually).
  useEffect(() => {
    if (!follow || activeSegmentId === null || (regex && total > 0)) return;
    if (!playing && document.activeElement?.closest("[data-transcript]")) return;
    scrollToEl(scrollRef.current?.querySelector(`#seg-${activeSegmentId}`) ?? null);
  }, [activeSegmentId, follow, playing, regex, total, scrollToEl]);

  const step = (d: number) => total && setCurrent((c) => (c + d + total) % total);

  return (
    <section data-transcript className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Transcript</h2>
          <span className="text-xs text-muted">{meeting.segments.length} lines</span>
          <button
            onClick={() => setEditing((e) => !e)}
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
              editing ? "bg-brand-600 text-white" : "text-muted hover:bg-black/5 hover:text-current dark:hover:bg-white/10",
            )}
            title={editing ? "Done editing (changes save automatically)" : "Edit transcript"}
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") step(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") props.onQueryChange("");
            }}
            placeholder="Find in transcript"
            className="h-8 w-full rounded-lg border bg-surface-muted pl-8 pr-28 text-xs outline-none focus:border-brand-400 focus:bg-surface"
          />
          {query && (
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-[11px] text-muted">
              <span className="mr-1 tabular-nums">{total ? `${current + 1} of ${total}` : "0 results"}</span>
              <button onClick={() => step(-1)} aria-label="Previous match" className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => step(1)} aria-label="Next match" className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => props.onQueryChange("")} aria-label="Clear search" className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        {(speakerFilter !== null || smartFilter) && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {speakerFilter !== null && (
              <button onClick={props.onClearSpeaker} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                Speaker: {meeting.participants.find((p) => p.id === speakerFilter)?.name} <X className="h-3 w-3" />
              </button>
            )}
            {smartFilter && (
              <button onClick={props.onClearSmart} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {SMART_FILTERS[smartFilter].label} <X className="h-3 w-3" />
              </button>
            )}
            <span className="py-0.5 text-muted">
              {visible.length} of {meeting.segments.length} lines
            </span>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        onWheel={() => !programmaticScroll.current && setFollow(false)}
        onTouchMove={() => setFollow(false)}
        className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2 scrollbar-thin"
      >
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {meeting.segments.length ? "No lines match these filters." : "This meeting has no transcript yet."}
          </p>
        ) : (
          visible.map((s) => (
            <TranscriptLine
              key={s.id}
              segment={s}
              active={s.id === activeSegmentId}
              regex={regex}
              firstMatchIndex={firstIndex.get(s.id) ?? 0}
              currentMatch={current}
              onSeek={props.onSeek}
              onComment={props.onComment}
              onDeleteComment={props.onDeleteComment}
              onSoundbite={props.onSoundbite}
              onCopyLink={props.onCopyLink}
              editable={editing}
              onEditText={props.onEditText}
            />
          ))
        )}
      </div>

      {!follow && activeSegmentId !== null && (
        <div className="pointer-events-none relative">
          <button
            onClick={() => {
              setFollow(true);
              scrollToEl(scrollRef.current?.querySelector(`#seg-${activeSegmentId}`) ?? null);
            }}
            className={cn(
              "pointer-events-auto absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full",
              "bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-zinc-900",
            )}
          >
            <LocateFixed className="h-3.5 w-3.5" /> Resume auto-scroll
          </button>
        </div>
      )}
    </section>
  );
}
