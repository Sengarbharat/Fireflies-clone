"use client";

import { ClipboardPaste, FileText, PencilLine, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { useInvalidate } from "@/lib/hooks";
import { Field, MeetingFields, type MeetingFieldValues, toLocalInput } from "./MeetingFields";

type Mode = "upload" | "paste" | "manual";

const MODES: { id: Mode; label: string; icon: typeof FileText }[] = [
  { id: "upload", label: "Upload file", icon: UploadCloud },
  { id: "paste", label: "Paste transcript", icon: ClipboardPaste },
  { id: "manual", label: "Manual", icon: PencilLine },
];

const PASTE_EXAMPLE = `[00:00:03] Jane Doe: Thanks for joining. Let's review the launch checklist.
[00:00:12] Sam Lee: I'll send the final pricing deck by Friday.`;

export function CreateMeetingModal({
  open,
  onClose,
  initialMode = "upload",
}: {
  open: boolean;
  onClose: () => void;
  initialMode?: Mode;
}) {
  const router = useRouter();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<MeetingFieldValues>({
    title: "",
    date: toLocalInput(),
    platform: "upload",
    participants: [],
    tags: [],
  });

  const reset = () => {
    setFile(null);
    setText("");
    setError(null);
    setValues({ title: "", date: toLocalInput(), platform: "upload", participants: [], tags: [] });
  };
  const close = () => {
    reset();
    onClose();
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(txt|vtt|srt|json)$/i.test(f.name)) {
      setError("Supported formats: .txt, .vtt, .srt, .json");
      return;
    }
    setError(null);
    setFile(f);
    if (!values.title) setValues((v) => ({ ...v, title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") }));
  };

  const submit = async () => {
    setError(null);
    const startedAt = values.date ? new Date(values.date).toISOString() : null;
    try {
      setBusy(true);
      let meeting;
      if (mode === "upload") {
        if (!file) return setError("Choose a transcript file first.");
        const form = new FormData();
        form.append("file", file);
        if (values.title.trim()) form.append("title", values.title.trim());
        if (startedAt) form.append("started_at", startedAt);
        form.append("platform", values.platform);
        form.append("participants", values.participants.join(","));
        form.append("tags", values.tags.join(","));
        meeting = await api.uploadTranscript(form);
      } else {
        if (!values.title.trim()) return setError("Give the meeting a title.");
        if (mode === "paste" && !text.trim()) return setError("Paste a transcript first.");
        meeting = await api.createMeeting({
          title: values.title.trim(),
          started_at: startedAt,
          platform: values.platform,
          participants: values.participants.map((name) => ({ name })),
          tags: values.tags,
          transcript_text: mode === "paste" ? text : null,
        });
      }
      await invalidate();
      toast.success(
        meeting.segments.length
          ? `Transcript processed: ${meeting.segments.length} lines, ${meeting.action_items.length} action items`
          : "Meeting created",
      );
      close();
      router.push(`/meetings/${meeting.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New meeting"
      description="Upload or paste a transcript and AI notes are generated automatically."
      size="lg"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {mode === "manual" ? "Create meeting" : "Transcribe & summarize"}
          </Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg bg-black/[0.04] p-1 dark:bg-white/5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
              mode === m.id ? "bg-surface shadow-sm" : "text-muted hover:text-current",
            )}
          >
            <m.icon className="h-3.5 w-3.5" /> {m.label}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "mb-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10" : "hover:border-brand-300",
          )}
        >
          <UploadCloud className="mb-2 h-8 w-8 text-brand-500" />
          {file ? (
            <p className="text-sm font-medium">
              {file.name} <span className="text-muted">({Math.ceil(file.size / 1024)} KB)</span>
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Drop a transcript here, or click to browse</p>
              <p className="mt-1 text-xs text-muted">.txt, .vtt, .srt or .json, up to 2 MB</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.vtt,.srt,.json"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>
      )}

      {mode === "paste" && (
        <div className="mb-5">
          <Field label="Transcript" hint="One line per utterance: [hh:mm:ss] Speaker: text. Timestamps are optional. VTT/SRT/JSON also work.">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder={PASTE_EXAMPLE}
              className="w-full rounded-lg border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/20"
            />
          </Field>
        </div>
      )}

      <MeetingFields values={values} onChange={setValues} />

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>
      )}
    </Modal>
  );
}
