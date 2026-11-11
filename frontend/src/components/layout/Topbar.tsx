"use client";

import { Bell, Menu, Moon, Plus, Radio, Search, Sun, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { CreateMeetingModal } from "@/components/meetings/CreateMeetingModal";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { fetcher } from "@/lib/api";
import type { User } from "@/lib/types";

export function Topbar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const { toggle } = useTheme();
  const toast = useToast();
  const { data: me } = useSWR<User>("/api/me", fetcher);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K (as in Fireflies) or "/" focuses global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      if ((e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-surface px-4">
      <button className="md:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>

      <form
        className="relative max-w-xl flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search across all meetings and transcripts"
          className="h-9 w-full rounded-lg border bg-surface-muted pl-9 pr-10 text-sm outline-none placeholder:text-muted focus:border-brand-400 focus:bg-surface focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/20"
        />
        <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 text-[10px] text-muted sm:block">Ctrl K</kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden lg:block">
          <Button variant="secondary" size="md" onClick={() => setLiveOpen(true)}>
            <Radio className="h-4 w-4 text-rose-500" /> Capture live
          </Button>
        </span>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New meeting</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle dark mode">
          {/* CSS decides which icon shows, so server and client markup always match */}
          <Sun className="hidden h-4 w-4 dark:block" />
          <Moon className="h-4 w-4 dark:hidden" />
        </Button>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setBellOpen((o) => !o)} aria-label="Notifications">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
          </Button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border bg-surface p-2 shadow-xl">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Notifications</p>
                {[
                  ["Your notes for “Investor Update Call” are ready", "/meetings"],
                  ["3 action items are due this week", "/tasks"],
                  ["Tip: upload a .vtt or .txt transcript to try AI notes", "/uploads"],
                ].map(([text, href]) => (
                  <Link
                    key={text}
                    href={href}
                    onClick={() => setBellOpen(false)}
                    className="block rounded-lg px-2 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/5"
                  >
                    {text}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
        <Link href="/settings" className="ml-1" aria-label="Profile and settings">
          <Avatar name={me?.name ?? "Me"} size="md" />
        </Link>
      </div>

      <CreateMeetingModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={liveOpen}
        onClose={() => setLiveOpen(false)}
        title="Capture a live meeting"
        description="Paste a Zoom, Google Meet or Teams link and the notetaker joins the call."
        footer={
          <>
            <Button onClick={() => setLiveOpen(false)}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                setLiveOpen(false);
                toast.info("The live notetaker is coming soon. Upload a transcript instead.");
              }}
            >
              <Upload className="h-4 w-4" /> Upload instead
            </Button>
          </>
        }
      >
        <input
          disabled
          placeholder="https://zoom.us/j/..."
          className="h-10 w-full rounded-lg border bg-surface-muted px-3 text-sm"
        />
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          Coming soon: a real-time bot joining calls isn&apos;t part of this demo. Transcripts are uploaded or pasted.
        </p>
      </Modal>
    </header>
  );
}
