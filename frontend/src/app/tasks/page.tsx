"use client";

import { CheckSquare } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { type ActionItemChange, ActionItemRow } from "@/components/action-items/ActionItemRow";
import { useToast } from "@/components/providers/ToastProvider";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api, fetcher } from "@/lib/api";
import { cn } from "@/lib/format";
import { useInvalidate } from "@/lib/hooks";
import type { ActionItem, ActionItemWithMeeting, Participant } from "@/lib/types";

const VIEWS = [
  { id: "open", label: "Open", query: "?completed=false" },
  { id: "done", label: "Completed", query: "?completed=true" },
  { id: "all", label: "All", query: "" },
] as const;

export default function TasksPage() {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("open");
  const [assignee, setAssignee] = useState("");
  const base = VIEWS.find((v) => v.id === view)!.query;
  const query = assignee ? `${base}${base ? "&" : "?"}assignee_id=${assignee}` : base;
  const { data, isLoading } = useSWR<ActionItemWithMeeting[]>(`/api/action-items${query}`, fetcher);
  const { data: people } = useSWR<Participant[]>("/api/participants", fetcher);

  const onChange = async (item: ActionItem, change: ActionItemChange) => {
    try {
      await api.updateActionItem(item.id, change);
      await invalidate();
      if (change.completed !== undefined) toast.success(change.completed ? "Marked as done" : "Reopened");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };
  const onDelete = async (item: ActionItem) => {
    await api.deleteActionItem(item.id);
    await invalidate();
    toast.success("Action item deleted");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <h1 className="text-xl font-semibold">Action items</h1>
      <p className="mt-0.5 text-sm text-muted">Every task captured across your meetings.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-black/[0.04] p-1 dark:bg-white/5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn("rounded-md px-3 py-1 text-sm font-medium", view === v.id ? "bg-surface shadow-sm" : "text-muted")}
            >
              {v.label}
            </button>
          ))}
        </div>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-9 rounded-lg border bg-surface px-2 text-sm" aria-label="Assignee">
          <option value="">Anyone</option>
          {people?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {data && <span className="text-sm text-muted">{data.length} items</span>}
      </div>

      <div className="mt-4 rounded-xl border bg-surface p-2">
        {isLoading && !data ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !data?.length ? (
          <EmptyState icon={<CheckSquare className="h-5 w-5" />} title={view === "open" ? "You're all caught up" : "No action items"} />
        ) : (
          data.map((item) => (
            <ActionItemRow
              key={item.id}
              item={item}
              meetingLink={{ id: item.meeting_id, title: item.meeting_title }}
              onChange={onChange}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
