"use client";

import { FileQuestion, MessageSquare, PanelLeftClose, PanelLeftOpen, Scissors, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { EditMeetingModal } from "@/components/meetings/EditMeetingModal";
import type { SmartFilter } from "@/components/meeting/filters";
import { InsightsRail } from "@/components/meeting/InsightsRail";
import { MediaPlayer } from "@/components/meeting/MediaPlayer";
import { MeetingHeader } from "@/components/meeting/MeetingHeader";
import { NotesPanel, type NotesTab } from "@/components/meeting/NotesPanel";
import { PrintView } from "@/components/meeting/PrintView";
import { TranscriptPanel } from "@/components/meeting/TranscriptPanel";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api, ApiError, fetcher } from "@/lib/api";
import { cn } from "@/lib/format";
import { useInvalidate } from "@/lib/hooks";
import type { MeetingDetail, Segment } from "@/lib/types";
import { useMediaClock } from "@/lib/useMediaClock";

function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const key = `/api/meetings/${id}`;
  const { data: meeting, error, mutate } = useSWR<MeetingDetail>(key, fetcher);

  const clock = useMediaClock((meeting?.duration_sec ?? 0) * 1000, meeting?.media_url);
  const [query, setQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<number | null>(null);
  const [smartFilter, setSmartFilter] = useState<SmartFilter | null>(null);
  const [tab, setTab] = useState<NotesTab>("summary");
  const [mobilePane, setMobilePane] = useState<"notes" | "transcript">("notes");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);

  // Deep link: /meetings/1?t=125000 seeks to that moment once loaded.
  const deepLinked = useRef(false);
  useEffect(() => {
    const t = Number(params.get("t"));
    if (meeting && !deepLinked.current && t > 0) {
      deepLinked.current = true;
      clock.seek(t);
      setMobilePane("transcript");
    }
  }, [meeting, params, clock]);

  // Active transcript line = last line that started at or before the playhead.
  const activeSegmentId = useMemo(() => {
    if (!meeting?.segments.length) return null;
    let active: number | null = null;
    for (const s of meeting.segments) {
      if (s.start_ms <= clock.currentMs + 50) active = s.id;
      else break;
    }
    return active;
  }, [meeting?.segments, clock.currentMs]);

  const refresh = useCallback(() => mutate(), [mutate]);
  const jump = useCallback(
    (ms: number) => {
      clock.seek(ms, { play: true });
      setMobilePane("transcript");
    },
    [clock],
  );

  const onComment = useCallback(
    async (segmentId: number, body: string) => {
      try {
        await api.addComment(segmentId, body);
        await refresh();
        toast.success("Comment added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add comment");
      }
    },
    [refresh, toast],
  );
  const onDeleteComment = useCallback(
    async (commentId: number) => {
      await api.deleteComment(commentId);
      await refresh();
    },
    [refresh],
  );
  const onSoundbite = useCallback(
    async (s: Segment) => {
      if (!meeting) return;
      const words = s.text.split(/\s+/).slice(0, 7).join(" ");
      try {
        await api.createSoundbite(meeting.id, {
          title: words.length < s.text.length ? `${words}...` : words,
          start_ms: s.start_ms,
          end_ms: Math.max(s.end_ms, s.start_ms + 15000),
        });
        await refresh();
        toast.success("Soundbite created");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create soundbite");
      }
    },
    [meeting, refresh, toast],
  );
  const onEditText = useCallback(
    async (segmentId: number, text: string) => {
      try {
        await api.updateSegment(segmentId, text);
        await refresh();
        toast.success("Transcript updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save the edit");
      }
    },
    [refresh, toast],
  );
  const regenerate = useCallback(async () => {
    if (!meeting) return;
    try {
      await mutate(await api.regenerateSummary(meeting.id), { revalidate: false });
      await invalidate();
      toast.success("AI notes regenerated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate notes");
    }
  }, [meeting, mutate, invalidate, toast]);
  const onCopyLink = useCallback(
    async (s: Segment) => {
      const url = `${window.location.origin}/meetings/${id}?t=${s.start_ms}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link to this moment copied");
      } catch {
        toast.info(url);
      }
    },
    [id, toast],
  );

  if (error) {
    return (
      <EmptyState
        icon={<FileQuestion className="h-5 w-5" />}
        title={error instanceof ApiError && error.status === 404 ? "Meeting not found" : "Couldn't load this meeting"}
        message={error instanceof ApiError && error.status === 404 ? "It may have been deleted." : error.message}
        action={
          <Link href="/meetings">
            <Button>Back to meetings</Button>
          </Link>
        }
      />
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-full flex-col">
        <div className="space-y-2 border-b bg-surface px-5 py-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="grid flex-1 gap-6 p-6 lg:grid-cols-2">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col print:hidden">
        <MeetingHeader
          meeting={meeting}
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onRegenerate={() => {
            setTab("summary");
            void regenerate();
          }}
        />

        {/* Mobile: switch between notes and transcript */}
        <div className="flex border-b bg-surface lg:hidden">
          {(["notes", "transcript"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setMobilePane(p)}
              className={cn(
                "flex-1 py-2 text-sm font-medium capitalize",
                mobilePane === p ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-300" : "text-muted",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Collapsible insights rail (Smart Search, speakers, comments, soundbites) */}
          <aside
            className={cn(
              "hidden shrink-0 border-r bg-surface xl:flex xl:flex-col",
              railOpen ? "w-60" : "w-12 items-center",
            )}
          >
            <button
              onClick={() => setRailOpen((o) => !o)}
              className={cn("flex items-center gap-2 border-b px-3 py-2.5 text-xs font-medium text-muted hover:text-current", railOpen ? "w-full" : "justify-center")}
              aria-label={railOpen ? "Collapse panel" : "Expand panel"}
              title={railOpen ? "Collapse panel" : "Smart Search, comments and soundbites"}
            >
              {railOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              {railOpen && "Smart Search"}
            </button>
            {!railOpen && (
              <div className="flex flex-col items-center gap-1 py-2 text-muted">
                {[
                  { icon: Search, label: "Smart Search" },
                  { icon: MessageSquare, label: "Comments" },
                  { icon: Scissors, label: "Soundbites" },
                ].map(({ icon: Icon, label }) => (
                  <button key={label} onClick={() => setRailOpen(true)} title={label} aria-label={label} className="rounded-lg p-2 hover:bg-black/5 hover:text-current dark:hover:bg-white/10">
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            )}
            {railOpen && (
              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            <InsightsRail
              meeting={meeting}
              speakerFilter={speakerFilter}
              onSpeaker={setSpeakerFilter}
              smartFilter={smartFilter}
              onSmart={setSmartFilter}
              onJump={jump}
              onDeleteSoundbite={async (sid) => {
                await api.deleteSoundbite(sid);
                await refresh();
                toast.success("Soundbite deleted");
              }}
            />
              </div>
            )}
          </aside>

          <div className={cn("min-w-0 flex-1 bg-surface", mobilePane === "notes" ? "block" : "hidden lg:block")}>
            <NotesPanel
              meeting={meeting}
              currentMs={clock.currentMs}
              onJump={jump}
              onKeyword={(k) => {
                setQuery(k);
                setMobilePane("transcript");
              }}
              onRegenerate={regenerate}
              onMutated={async () => {
                await refresh();
                await invalidate();
              }}
              tab={tab}
              onTabChange={setTab}
            />
          </div>

          <div
            className={cn(
              "min-w-0 border-l bg-surface lg:w-[440px] lg:shrink-0 2xl:w-[520px]",
              mobilePane === "transcript" ? "flex-1" : "hidden lg:block",
            )}
          >
            <TranscriptPanel
              meeting={meeting}
              activeSegmentId={activeSegmentId}
              playing={clock.playing}
              query={query}
              onQueryChange={setQuery}
              speakerFilter={speakerFilter}
              onClearSpeaker={() => setSpeakerFilter(null)}
              smartFilter={smartFilter}
              onClearSmart={() => setSmartFilter(null)}
              onSeek={jump}
              onComment={onComment}
              onDeleteComment={onDeleteComment}
              onSoundbite={onSoundbite}
              onCopyLink={onCopyLink}
              onEditText={onEditText}
            />
          </div>
        </div>

        <MediaPlayer clock={clock} segments={meeting.segments} chapters={meeting.chapters} />
      </div>

      <PrintView meeting={meeting} />

      <EditMeetingModal meeting={meeting} open={editOpen} onClose={() => setEditOpen(false)} onSaved={(m) => mutate(m, { revalidate: false })} />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete meeting?"
        message={`"${meeting.title}" and its transcript, notes and action items will be permanently deleted.`}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          try {
            await api.deleteMeeting(meeting.id);
            await invalidate();
            toast.success("Meeting deleted");
            router.push("/meetings");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
            setDeleteOpen(false);
          }
        }}
      />
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <MeetingPage />
    </Suspense>
  );
}
