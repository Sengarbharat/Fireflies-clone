"use client";

import {
  ChevronLeft,
  Download,
  FileDown,
  FileText,
  Link2,
  MoreHorizontal,
  Pencil,
  Printer,
  RefreshCw,
  Share2,
  Trash2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PlatformIcon, TagPill } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { formatDateTime, formatDuration, PLATFORM_LABEL } from "@/lib/format";
import type { MeetingDetail } from "@/lib/types";

function Menu({ children, trigger }: { children: React.ReactNode; trigger: (toggle: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-48 rounded-lg border bg-surface p-1 shadow-lg" onClick={() => setOpen(false)}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

const itemClass = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/5";

export function MeetingHeader({
  meeting,
  onEdit,
  onDelete,
  onRegenerate,
}: {
  meeting: MeetingDetail;
  onEdit: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
}) {
  const toast = useToast();
  const copyLink = async () => {
    const url = `${window.location.origin}/meetings/${meeting.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Meeting link copied");
    } catch {
      toast.info(url);
    }
  };
  return (
    <div className="no-print flex flex-wrap items-start gap-4 border-b bg-surface px-5 py-4">
      <Link href="/meetings" className="mt-0.5 rounded-md p-1 text-muted hover:bg-black/5 hover:text-current dark:hover:bg-white/10" aria-label="Back to meetings">
        <ChevronLeft className="h-5 w-5" />
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold leading-tight">{meeting.title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          <span>{formatDateTime(meeting.started_at)}</span>
          <span>&middot;</span>
          <span>{formatDuration(meeting.duration_sec)}</span>
          <span>&middot;</span>
          <span className="inline-flex items-center gap-1.5">
            <PlatformIcon platform={meeting.platform} className="h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5" />
            {PLATFORM_LABEL[meeting.platform]}
          </span>
          {meeting.tags.map((t) => (
            <TagPill key={t.id} tag={t} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <AvatarStack people={meeting.participants} max={5} />
        <Button size="sm" className="hidden md:inline-flex" onClick={() => toast.info("AI Skills (automated follow-ups and custom apps) are coming soon.")}>
          <Wand2 className="h-3.5 w-3.5 text-brand-600" /> AI Skills
        </Button>
        <Button size="sm" variant="primary" onClick={() => toast.info("Sharing the recap with your team is coming soon. Use Copy link for now.")}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
        <Menu
          trigger={(toggle) => (
            <Button size="sm" onClick={toggle}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          )}
        >
          <a href={api.exportUrl(meeting.id, "md")} className={itemClass}>
            <FileDown className="h-3.5 w-3.5" /> Markdown (.md)
          </a>
          <a href={api.exportUrl(meeting.id, "txt")} className={itemClass}>
            <FileText className="h-3.5 w-3.5" /> Plain text (.txt)
          </a>
          <button onClick={() => setTimeout(() => window.print(), 50)} className={itemClass}>
            <Printer className="h-3.5 w-3.5" /> PDF (print)
          </button>
        </Menu>
        <Menu
          trigger={(toggle) => (
            <Button size="icon" variant="ghost" onClick={toggle} aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        >
          <button onClick={copyLink} className={itemClass}>
            <Link2 className="h-3.5 w-3.5" /> Copy link
          </button>
          <button onClick={onRegenerate} className={itemClass}>
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate notes
          </button>
          <button onClick={onEdit} className={itemClass}>
            <Pencil className="h-3.5 w-3.5" /> Rename / edit details
          </button>
          <a href={api.exportUrl(meeting.id, "md")} className={itemClass}>
            <Download className="h-3.5 w-3.5" /> Download
          </a>
          <button onClick={onDelete} className={`${itemClass} text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10`}>
            <Trash2 className="h-3.5 w-3.5" /> Delete meeting
          </button>
        </Menu>
      </div>
    </div>
  );
}
