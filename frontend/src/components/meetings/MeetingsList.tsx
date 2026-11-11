"use client";

import { Mic, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { dateGroupLabel } from "@/lib/format";
import { useInvalidate } from "@/lib/hooks";
import type { MeetingListItem } from "@/lib/types";
import { EditMeetingModal } from "./EditMeetingModal";
import { Checkbox, MeetingRow, type RowAction } from "./MeetingRow";

/** Meetings grouped under date headers, with per-row actions and multi-select. */
export function MeetingsList({
  meetings,
  loading,
  grouped = true,
  empty,
  onTagClick,
}: {
  meetings: MeetingListItem[] | undefined;
  loading?: boolean;
  grouped?: boolean;
  empty?: React.ReactNode;
  onTagClick?: (tag: string) => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<MeetingListItem | null>(null);
  const [deleting, setDeleting] = useState<MeetingListItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Drop selections that are no longer in the list (after filtering/deleting).
  useEffect(() => {
    if (!meetings) return;
    const ids = new Set(meetings.map((m) => m.id));
    setSelected((s) => new Set([...s].filter((id) => ids.has(id))));
  }, [meetings]);

  if (loading && !meetings) {
    return (
      <div className="divide-y rounded-xl border bg-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-11 w-14" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!meetings?.length) {
    return (
      <div className="rounded-xl border bg-surface">
        {empty ?? <EmptyState icon={<Mic className="h-5 w-5" />} title="No meetings found" message="Try a different search or filter." />}
      </div>
    );
  }

  const toggle = (ids: number[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const onAction = async (action: RowAction, m: MeetingListItem) => {
    const link = `${window.location.origin}/meetings/${m.id}`;
    if (action === "rename") setEditing(m);
    else if (action === "delete") setDeleting([m]);
    else if (action === "download") window.location.href = api.exportUrl(m.id, "md");
    else if (action === "share") toast.info("Sharing with your team is coming soon. Use Copy link for now.");
    else {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Meeting link copied");
      } catch {
        toast.info(link);
      }
    }
  };

  const groups: [string, MeetingListItem[]][] = [];
  for (const m of meetings) {
    const label = grouped ? dateGroupLabel(m.started_at) : "";
    const last = groups[groups.length - 1];
    if (last && last[0] === label) last[1].push(m);
    else groups.push([label, [m]]);
  }

  const allIds = meetings.map((m) => m.id);
  const allSelected = allIds.every((id) => selected.has(id));
  const selecting = selected.size > 0;

  return (
    <>
      <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted">
        <Checkbox checked={allSelected} onChange={() => toggle(allIds, !allSelected)} label="Select all meetings" />
        <span>{selecting ? `${selected.size} selected` : "Select all"}</span>
      </div>

      <div className="space-y-5">
        {groups.map(([label, items]) => {
          const ids = items.map((m) => m.id);
          const groupSelected = ids.every((id) => selected.has(id));
          return (
            <section key={label || "all"}>
              {label && (
                <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  <Checkbox checked={groupSelected} onChange={() => toggle(ids, !groupSelected)} label={`Select meetings from ${label}`} />
                  {label}
                </h2>
              )}
              <div className="overflow-hidden rounded-xl border bg-surface">
                {items.map((m) => (
                  <MeetingRow
                    key={m.id}
                    meeting={m}
                    onAction={onAction}
                    onTagClick={onTagClick}
                    selected={selected.has(m.id)}
                    selecting={selecting}
                    onToggleSelect={(x) => toggle([x.id], !selected.has(x.id))}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {selecting && (
        <div className="sticky bottom-4 z-20 mt-4 flex justify-center">
          <div className="flex items-center gap-3 rounded-xl border bg-surface px-4 py-2.5 shadow-xl">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button size="sm" variant="danger" onClick={() => setDeleting(meetings.filter((m) => selected.has(m.id)))}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>
      )}

      {editing && <EditMeetingModal meeting={editing} open onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} meetings?` : "Delete meeting?"}
        message={
          deleting && deleting.length > 1
            ? "These meetings and their transcripts, notes and action items will be permanently deleted."
            : `"${deleting?.[0]?.title}" and its transcript, notes and action items will be permanently deleted.`
        }
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            const { deleted } = await api.bulkDelete(deleting.map((m) => m.id));
            await invalidate();
            setSelected(new Set());
            toast.success(deleted > 1 ? `${deleted} meetings deleted` : "Meeting deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
          setDeleting(null);
        }}
      />
    </>
  );
}
