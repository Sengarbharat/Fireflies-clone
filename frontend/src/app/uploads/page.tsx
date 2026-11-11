"use client";

import { FileText, UploadCloud } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { CreateMeetingModal } from "@/components/meetings/CreateMeetingModal";
import { MeetingsList } from "@/components/meetings/MeetingsList";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { fetcher } from "@/lib/api";
import type { MeetingList } from "@/lib/types";

const FORMATS = [
  { ext: ".txt", example: "[00:01:05] Jane Doe: Let's start with the roadmap." },
  { ext: ".vtt", example: "00:01:05.000 --> 00:01:09.000\n<v Jane Doe>Let's start with the roadmap." },
  { ext: ".srt", example: "1\n00:01:05,000 --> 00:01:09,000\nJane Doe: Let's start..." },
  { ext: ".json", example: '[{"speaker": "Jane Doe", "start": 65, "text": "..."}]' },
];

export default function UploadsPage() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useSWR<MeetingList>("/api/meetings?source=upload&page_size=100", fetcher);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Uploads</h1>
          <p className="mt-0.5 text-sm text-muted">Transcripts you&apos;ve uploaded or pasted.</p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <UploadCloud className="h-4 w-4" /> Upload transcript
        </Button>
      </div>

      <button
        onClick={() => setOpen(true)}
        className="mt-5 flex w-full flex-col items-center rounded-2xl border-2 border-dashed bg-surface px-6 py-10 text-center hover:border-brand-300"
      >
        <UploadCloud className="h-9 w-9 text-brand-500" />
        <span className="mt-2 text-sm font-semibold">Upload a transcript to get AI notes</span>
        <span className="mt-1 text-xs text-muted">Speaker labels, timestamps, summary, outline and action items are extracted automatically.</span>
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATS.map((f) => (
          <div key={f.ext} className="rounded-xl border bg-surface p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <FileText className="h-3.5 w-3.5 text-brand-500" /> {f.ext}
            </div>
            <pre className="mt-2 overflow-hidden whitespace-pre-wrap break-all font-mono text-[10px] text-muted">{f.example}</pre>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Your uploads</h2>
      <MeetingsList
        meetings={data?.items}
        loading={isLoading}
        grouped={false}
        empty={<EmptyState icon={<UploadCloud className="h-5 w-5" />} title="No uploads yet" message="Sample files are in the repo's samples/ folder." />}
      />

      <CreateMeetingModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
