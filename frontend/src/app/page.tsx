"use client";

import { ArrowRight, CalendarDays, CheckSquare, Clock, Mic, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { type ActionItemChange, ActionItemRow } from "@/components/action-items/ActionItemRow";
import { CreateMeetingModal } from "@/components/meetings/CreateMeetingModal";
import { MeetingRow } from "@/components/meetings/MeetingRow";
import { useToast } from "@/components/providers/ToastProvider";
import { Skeleton } from "@/components/ui/misc";
import { api, fetcher } from "@/lib/api";
import { useInvalidate } from "@/lib/hooks";
import type { ActionItem, ActionItemWithMeeting, MeetingList, User } from "@/lib/types";

/** Time-of-day greeting, computed only in the browser: this page is prerendered
 * at build time (server clock, UTC), so rendering it there would mismatch the
 * viewer's local time during hydration. */
function useGreeting() {
  const [text, setText] = useState("Welcome back");
  useEffect(() => {
    const h = new Date().getHours();
    setText(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  return text;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Mic; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function HomePage() {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const greeting = useGreeting();
  const { data: me } = useSWR<User>("/api/me", fetcher);
  const { data: all } = useSWR<MeetingList>("/api/meetings?page_size=100", fetcher);
  const { data: tasks } = useSWR<ActionItemWithMeeting[]>("/api/action-items?completed=false", fetcher);

  const recent = all?.items.slice(0, 5);
  const totalMinutes = all ? Math.round(all.items.reduce((s, m) => s + m.duration_sec, 0) / 60) : null;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = all?.items.filter((m) => new Date(m.started_at).getTime() >= weekAgo).length;

  const onChange = async (item: ActionItem, change: ActionItemChange) => {
    await api.updateActionItem(item.id, change);
    await invalidate();
    if (change.completed) toast.success("Nice! Action item completed");
  };
  const onDelete = async (item: ActionItem) => {
    await api.deleteActionItem(item.id);
    await invalidate();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-semibold">
        {greeting}
        {me ? `, ${me.name.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted">Here&apos;s what&apos;s happening across your meetings.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Mic} label="Meetings" value={all ? all.total : <Skeleton className="h-7 w-10" />} />
        <Stat icon={CalendarDays} label="Last 7 days" value={thisWeek ?? <Skeleton className="h-7 w-10" />} />
        <Stat icon={Clock} label="Minutes transcribed" value={totalMinutes ?? <Skeleton className="h-7 w-14" />} />
        <Stat icon={CheckSquare} label="Open action items" value={tasks ? tasks.length : <Skeleton className="h-7 w-10" />} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent meetings</h2>
            <Link href="/meetings" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border bg-surface">
            {recent
              ? recent.map((m) => <MeetingRow key={m.id} meeting={m} />)
              : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="m-4 h-12" />)}
          </div>
        </section>

        <div className="space-y-6">
          <button
            onClick={() => setUploadOpen(true)}
            className="flex w-full items-center gap-4 rounded-xl bg-gradient-to-br from-brand-600 to-fuchsia-500 p-5 text-left text-white shadow-lg shadow-brand-600/20 hover:opacity-95"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
              <UploadCloud className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Upload a transcript</span>
              <span className="block text-xs text-white/80">Get a summary, outline and action items in seconds.</span>
            </span>
          </button>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your open action items</h2>
              <Link href="/tasks" className="text-xs font-medium text-brand-600 hover:underline">
                See all
              </Link>
            </div>
            <div className="rounded-xl border bg-surface p-1.5">
              {tasks?.length === 0 && <p className="p-4 text-center text-sm text-muted">You&apos;re all caught up.</p>}
              {tasks?.slice(0, 6).map((t) => (
                <ActionItemRow key={t.id} item={t} meetingLink={{ id: t.meeting_id, title: t.meeting_title }} onChange={onChange} onDelete={onDelete} />
              ))}
              {!tasks && <Skeleton className="m-2 h-24" />}
            </div>
          </section>
        </div>
      </div>

      <CreateMeetingModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
