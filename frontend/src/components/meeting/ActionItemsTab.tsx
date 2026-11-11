"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { type ActionItemChange, ActionItemRow } from "@/components/action-items/ActionItemRow";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import type { ActionItem, MeetingDetail } from "@/lib/types";

export function ActionItemsTab({
  meeting,
  currentMs,
  onMutated,
  onJump,
}: {
  meeting: MeetingDetail;
  currentMs: number;
  onMutated: () => Promise<unknown>;
  onJump: (ms: number) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const open = meeting.action_items.filter((a) => !a.completed);
  const done = meeting.action_items.filter((a) => a.completed);

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      await onMutated();
      if (success) toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const onChange = (item: ActionItem, change: ActionItemChange) =>
    run(
      () => api.updateActionItem(item.id, change),
      change.completed === true ? "Action item completed" : undefined,
    );
  const onDelete = (item: ActionItem) => run(() => api.deleteActionItem(item.id), "Action item deleted");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    await run(
      () =>
        api.createActionItem(meeting.id, {
          text: text.trim(),
          assignee_id: assignee ? Number(assignee) : null,
          source_start_ms: Math.round(currentMs) || null,
        }),
      "Action item added",
    );
    setText("");
    setAssignee("");
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap gap-2 rounded-xl border bg-surface-muted p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an action item..."
          className="h-8 min-w-48 flex-1 rounded-md bg-transparent px-2 text-sm outline-none"
        />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-8 rounded-md border bg-surface px-2 text-xs" aria-label="Assign to">
          <option value="">Unassigned</option>
          {meeting.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button disabled={busy || !text.trim()} className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </form>

      {meeting.action_items.length === 0 && <p className="py-6 text-center text-sm text-muted">No action items yet.</p>}

      {open.length > 0 && (
        <div>
          <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Open ({open.length})</h3>
          {open.map((a) => (
            <ActionItemRow key={a.id} item={a} participants={meeting.participants} onChange={onChange} onDelete={onDelete} onJump={onJump} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div>
          <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Completed ({done.length})</h3>
          {done.map((a) => (
            <ActionItemRow key={a.id} item={a} participants={meeting.participants} onChange={onChange} onDelete={onDelete} onJump={onJump} />
          ))}
        </div>
      )}
    </div>
  );
}
