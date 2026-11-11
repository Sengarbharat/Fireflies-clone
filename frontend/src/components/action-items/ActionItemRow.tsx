"use client";

import { CalendarDays, Check, PlayCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatDate, formatTimestamp } from "@/lib/format";
import type { ActionItem, Participant } from "@/lib/types";

export interface ActionItemChange {
  text?: string;
  assignee_id?: number | null;
  due_date?: string | null;
  completed?: boolean;
}

interface Props {
  item: ActionItem;
  participants?: Participant[]; // assignable people; omit to make assignee read-only
  meetingLink?: { id: number; title: string };
  onChange: (item: ActionItem, change: ActionItemChange) => Promise<void>;
  onDelete: (item: ActionItem) => Promise<void>;
  onJump?: (ms: number) => void;
}

function isOverdue(item: ActionItem) {
  return !item.completed && !!item.due_date && item.due_date < new Date().toISOString().slice(0, 10);
}

export function ActionItemRow({ item, participants, meetingLink, onChange, onDelete, onJump }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  const commitText = async () => {
    setEditing(false);
    const t = text.trim();
    if (t && t !== item.text) await onChange(item, { text: t });
    else setText(item.text);
  };

  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-black/[0.025] dark:hover:bg-white/[0.03]">
      <button
        onClick={() => onChange(item, { completed: !item.completed })}
        aria-label={item.completed ? "Mark as not done" : "Mark as done"}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
          item.completed ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 hover:border-brand-500 dark:border-zinc-600",
        )}
      >
        {item.completed && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") {
                setText(item.text);
                setEditing(false);
              }
            }}
            className="w-full rounded-md border bg-surface px-2 py-1 text-sm outline-none focus:border-brand-400"
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            title="Click to edit"
            className={cn("cursor-text text-sm leading-snug", item.completed && "text-muted line-through")}
          >
            {item.text}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          {participants ? (
            <label className="inline-flex items-center gap-1">
              {item.assignee && <Avatar name={item.assignee.name} size="xs" />}
              <select
                value={item.assignee?.id ?? ""}
                onChange={(e) => onChange(item, { assignee_id: e.target.value ? Number(e.target.value) : null })}
                className="max-w-36 cursor-pointer rounded bg-transparent py-0.5 outline-none hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : item.assignee ? (
            <span className="inline-flex items-center gap-1">
              <Avatar name={item.assignee.name} size="xs" /> {item.assignee.name}
            </span>
          ) : (
            <span>Unassigned</span>
          )}

          <label className={cn("inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10", isOverdue(item) && "text-rose-600")}>
            <CalendarDays className="h-3 w-3" />
            <span className="sr-only">Due date</span>
            {item.due_date ? formatDate(item.due_date + "T12:00:00", { year: undefined }) : "No due date"}
            <input
              type="date"
              value={item.due_date ?? ""}
              onChange={(e) => onChange(item, { due_date: e.target.value || null })}
              className="w-4 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              style={{ marginLeft: "-1rem" }}
            />
          </label>

          {item.source_start_ms !== null && onJump && (
            <button onClick={() => onJump(item.source_start_ms!)} className="inline-flex items-center gap-1 hover:text-brand-600">
              <PlayCircle className="h-3 w-3" /> {formatTimestamp(item.source_start_ms)}
            </button>
          )}

          {meetingLink && (
            <Link
              href={`/meetings/${meetingLink.id}${item.source_start_ms !== null ? `?t=${item.source_start_ms}` : ""}`}
              className="truncate hover:text-brand-600 hover:underline"
            >
              {meetingLink.title}
            </Link>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(item)}
        aria-label="Delete action item"
        className="rounded p-1 text-muted opacity-0 hover:text-rose-600 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
