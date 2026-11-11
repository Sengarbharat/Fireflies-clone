"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { cn, formatTimestamp } from "@/lib/format";
import type { AskResponse } from "@/lib/types";

const SUGGESTIONS = ["What are the action items?", "Summarize this meeting", "What was decided?", "Who spoke the most?"];

type Message = { role: "user"; text: string } | { role: "assistant"; response: AskResponse } | { role: "error"; text: string };

/** "Ask AI" chat about one meeting. Answers cite transcript moments. */
export function AskTab({ meetingId, onJump }: { meetingId: number; onJump: (ms: number) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Block body on purpose: newer browsers return a Promise from scrollIntoView,
    // and an effect must return nothing or a cleanup function.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setDraft("");
    setBusy(true);
    try {
      const response = await api.ask(meetingId, question);
      setMessages((m) => [...m, { role: "assistant", response }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: e instanceof Error ? e.message : "Couldn't get an answer" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[420px] flex-col">
      <div className="flex-1 space-y-4">
        {messages.length === 0 && (
          <div className="rounded-xl bg-gradient-to-br from-brand-50 to-pink-50 p-5 dark:from-brand-500/10 dark:to-pink-500/5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-brand-600" /> Ask anything about this meeting
            </div>
            <p className="mt-1 text-xs text-muted">Answers come from the transcript and link back to the exact moment.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border bg-surface px-3 py-1 text-xs hover:border-brand-300 hover:text-brand-700">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm text-white">{m.text}</div>
            </div>
          ) : m.role === "error" ? (
            <p key={i} className="text-sm text-rose-600">{m.text}</p>
          ) : (
            <div key={i} className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-brand-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border bg-surface px-3.5 py-2.5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.response.answer}</p>
                {m.response.citations.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.response.citations.map((c) => (
                      <button
                        key={c.segment_id}
                        onClick={() => onJump(c.start_ms)}
                        title={c.text}
                        className="rounded-md bg-brand-50 px-1.5 py-0.5 font-mono text-[11px] text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300"
                      >
                        {formatTimestamp(c.start_ms)} {c.speaker?.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted">
                  {m.response.generated_by === "llm" ? "Answered by Claude" : "Answered from transcript search"}
                </p>
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner className="h-4 w-4" /> Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="sticky bottom-0 mt-4 flex items-center gap-2 rounded-xl border bg-surface p-1.5 shadow-sm"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question about this meeting..."
          className="h-8 flex-1 bg-transparent px-2 text-sm outline-none"
        />
        <button
          disabled={!draft.trim() || busy}
          aria-label="Send"
          className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-40")}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
