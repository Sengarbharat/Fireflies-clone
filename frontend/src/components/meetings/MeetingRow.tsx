"use client";

import { Check, CheckSquare, Clock, Download, Link2, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AvatarStack } from "@/components/ui/Avatar";
import { PlatformIcon, TagPill } from "@/components/ui/misc";
import { cn, formatDate, formatDuration, formatTime } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";

export type RowAction = "share" | "copy-link" | "download" | "rename" | "delete";

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] transition-colors",
        checked ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 bg-surface hover:border-brand-500 dark:border-zinc-600",
        className,
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

const MENU: { id: RowAction; label: string; icon: typeof Share2; danger?: boolean }[] = [
  { id: "share", label: "Share", icon: Share2 },
  { id: "copy-link", label: "Copy link", icon: Link2 },
  { id: "download", label: "Download notes", icon: Download },
  { id: "rename", label: "Rename / edit", icon: Pencil },
  { id: "delete", label: "Delete", icon: Trash2, danger: true },
];

export function MeetingRow({
  meeting,
  onAction,
  onTagClick,
  selected,
  selecting,
  onToggleSelect,
}: {
  meeting: MeetingListItem;
  onAction?: (action: RowAction, m: MeetingListItem) => void;
  onTagClick?: (tag: string) => void;
  selected?: boolean;
  selecting?: boolean; // any row selected: keep checkboxes visible
  onToggleSelect?: (m: MeetingListItem) => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 border-b px-5 py-3.5 last:border-b-0",
        selected ? "bg-brand-50/60 dark:bg-brand-500/10" : "hover:bg-black/[0.015] dark:hover:bg-white/[0.02]",
      )}
    >
      <Link href={`/meetings/${meeting.id}`} className="absolute inset-0" aria-label={meeting.title} />

      {onToggleSelect && (
        <span className={cn("relative z-10 -mr-1 transition-opacity", selecting || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          <Checkbox checked={!!selected} onChange={() => onToggleSelect(meeting)} label={`Select ${meeting.title}`} />
        </span>
      )}

      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border bg-surface-muted py-1 text-center">
        <span className="text-[10px] font-semibold uppercase text-brand-600">
          {new Date(meeting.started_at).toLocaleDateString("en-US", { month: "short" })}
        </span>
        <span className="text-lg font-semibold leading-none">{new Date(meeting.started_at).getDate()}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={meeting.platform} className="h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5" />
          <h3 className="truncate text-sm font-semibold">{meeting.title}</h3>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>
            {formatDate(meeting.started_at, { year: undefined, weekday: "short" })}, {formatTime(meeting.started_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatDuration(meeting.duration_sec)}
          </span>
          {meeting.action_items_total > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> {meeting.action_items_open} open / {meeting.action_items_total}
            </span>
          )}
          {meeting.tags.map((t) => (
            <span key={t.id} className="relative z-10">
              <TagPill tag={t} onClick={onTagClick ? () => onTagClick(t.name) : undefined} />
            </span>
          ))}
        </div>
        {meeting.overview && <p className="mt-1.5 line-clamp-1 text-xs text-muted">{meeting.overview}</p>}
      </div>

      <div className="hidden shrink-0 sm:block">
        <AvatarStack people={meeting.participants} />
      </div>

      {onAction && (
        <div className="relative z-10 shrink-0">
          <button
            onClick={() => setMenu((o) => !o)}
            className={cn(
              "rounded-md p-1.5 text-muted opacity-0 hover:bg-black/5 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-white/10",
              menu && "opacity-100",
            )}
            aria-label="Meeting actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border bg-surface p-1 shadow-lg">
                {MENU.map(({ id, label, icon: Icon, danger }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setMenu(false);
                      onAction(id, meeting);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      danger ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" : "hover:bg-black/[0.04] dark:hover:bg-white/5",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
