"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn, formatTimestamp, hexColorFor } from "@/lib/format";
import type { Chapter, Segment } from "@/lib/types";
import type { MediaClock } from "@/lib/useMediaClock";

const RATES = [0.75, 1, 1.25, 1.5, 2];

/** Bottom playback bar. The seek track doubles as a speaker timeline. */
export function MediaPlayer({ clock, segments, chapters }: { clock: MediaClock; segments: Segment[]; chapters: Chapter[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const dur = Math.max(1, clock.durationMs);
  const pct = (ms: number) => `${(ms / dur) * 100}%`;

  // Merge consecutive lines by the same speaker into timeline blocks.
  const blocks = useMemo(() => {
    const out: { start: number; end: number; speaker: string }[] = [];
    for (const s of segments) {
      const name = s.speaker?.name ?? "Unknown";
      const last = out[out.length - 1];
      if (last && last.speaker === name && s.start_ms - last.end < 1500) last.end = s.end_ms;
      else out.push({ start: s.start_ms, end: s.end_ms, speaker: name });
    }
    return out;
  }, [segments]);

  const msFromEvent = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.round(((clientX - rect.left) / rect.width) * dur);
  };

  return (
    <div className="no-print flex shrink-0 items-center gap-3 border-t bg-surface px-4 py-2.5 sm:gap-4 sm:px-6">
      <div className="flex items-center gap-1">
        <button onClick={() => clock.skip(-15000)} className="rounded-full p-1.5 text-muted hover:bg-black/5 hover:text-current dark:hover:bg-white/10" aria-label="Back 15 seconds" title="Back 15s">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={clock.toggle}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-md shadow-brand-600/30 hover:bg-brand-700"
          aria-label={clock.playing ? "Pause" : "Play"}
        >
          {clock.playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <button onClick={() => clock.skip(15000)} className="rounded-full p-1.5 text-muted hover:bg-black/5 hover:text-current dark:hover:bg-white/10" aria-label="Forward 15 seconds" title="Forward 15s">
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      <span className="hidden w-24 shrink-0 text-center font-mono text-xs tabular-nums text-muted sm:inline">
        {formatTimestamp(clock.currentMs)} / {formatTimestamp(clock.durationMs)}
      </span>

      <div className="relative flex-1 py-2">
        <div
          ref={trackRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={dur}
          aria-valuenow={Math.round(clock.currentMs)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") clock.skip(5000);
            if (e.key === "ArrowLeft") clock.skip(-5000);
          }}
          onMouseMove={(e) => setHoverMs(msFromEvent(e.clientX))}
          onMouseLeave={() => setHoverMs(null)}
          onClick={(e) => clock.seek(msFromEvent(e.clientX))}
          className="group relative h-2.5 cursor-pointer rounded-full bg-black/[0.06] dark:bg-white/10"
        >
          {/* speaker timeline */}
          {blocks.map((b, i) => (
            <span
              key={i}
              className="absolute top-0 h-full opacity-35 first:rounded-l-full"
              style={{ left: pct(b.start), width: pct(Math.max(200, b.end - b.start)), background: hexColorFor(b.speaker) }}
            />
          ))}
          {/* progress */}
          <span className="absolute left-0 top-0 h-full rounded-full bg-brand-500/70" style={{ width: pct(clock.currentMs) }} />
          {/* chapter markers */}
          {chapters.map((c) => (
            <span key={c.id} title={c.title} className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-[var(--surface)]" style={{ left: pct(c.start_ms) }} />
          ))}
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow"
            style={{ left: pct(clock.currentMs) }}
          />
          {hoverMs !== null && (
            <span
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-white"
              style={{ left: pct(hoverMs) }}
            >
              {formatTimestamp(hoverMs)}
            </span>
          )}
        </div>
      </div>

      <select
        value={clock.rate}
        onChange={(e) => clock.setRate(Number(e.target.value))}
        aria-label="Playback speed"
        className="h-7 cursor-pointer rounded-md border bg-surface px-1.5 text-xs font-medium"
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            {r}x
          </option>
        ))}
      </select>

      {clock.simulated && (
        <span
          className={cn("hidden items-center gap-1 text-[10px] text-muted xl:flex")}
          title="This meeting has no recording attached, so playback is simulated against the transcript timestamps."
        >
          <span className="flex h-3 items-end gap-px">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-0.5 rounded-sm bg-brand-400"
                style={{ height: "100%", animation: clock.playing ? `eq 0.9s ${i * 0.15}s ease-in-out infinite` : undefined, transform: "scaleY(0.4)" }}
              />
            ))}
          </span>
          No recording
        </span>
      )}
    </div>
  );
}
