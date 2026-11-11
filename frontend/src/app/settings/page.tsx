"use client";

import { Moon, Sun } from "lucide-react";
import useSWR from "swr";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { API_URL, fetcher } from "@/lib/api";
import { cn } from "@/lib/format";
import type { User } from "@/lib/types";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b py-6 last:border-b-0 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

const disabledInput = "h-9 w-full max-w-sm rounded-lg border bg-surface-muted px-3 text-sm text-muted";

export default function SettingsPage() {
  const { data: me } = useSWR<User>("/api/me", fetcher);
  const { data: health } = useSWR<{ status: string; llm: string }>("/api/health", fetcher);
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-0.5 text-sm text-muted">Manage your profile, appearance and notetaker preferences.</p>

      <div className="mt-4 rounded-2xl border bg-surface px-6">
        <Section title="Profile" description="Real authentication is out of scope. You're signed in as the default workspace user.">
          <div className="flex items-center gap-4">
            <Avatar name={me?.name ?? "?"} size="lg" />
            <div className="space-y-2">
              <input disabled value={me?.name ?? ""} className={disabledInput} aria-label="Name" />
              <input disabled value={me?.email ?? ""} className={disabledInput} aria-label="Email" />
            </div>
          </div>
        </Section>

        <Section title="Appearance">
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm capitalize",
                  theme === t && "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
                )}
              >
                {t === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {t}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Notetaker" description="How the bot behaves when it joins calls.">
          <div className="space-y-3 text-sm">
            {["Auto-join calendar meetings with a video link", "Email me a recap after each meeting", "Share notes with all participants"].map((label) => (
              <label key={label} className="flex items-center justify-between gap-4 opacity-60">
                {label}
                <span className="relative h-5 w-9 rounded-full bg-zinc-300 dark:bg-zinc-600">
                  <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white" />
                </span>
              </label>
            ))}
            <p className="text-xs text-muted">Coming soon: these settings need the live meeting bot.</p>
          </div>
        </Section>

        <Section title="AI notes engine" description="Set ANTHROPIC_API_KEY on the backend to use Claude for notes and Ask AI.">
          <p className="text-sm">
            Currently using:{" "}
            <span className="font-medium">
              {health ? (health.llm === "anthropic" ? "Claude (Anthropic API)" : "Built-in rule-based summarizer") : "..."}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">API: {API_URL}</p>
        </Section>

        <Section title="Danger zone">
          <Button variant="secondary" onClick={() => toast.info("Account deletion is disabled in the demo.")}>
            Delete workspace
          </Button>
        </Section>
      </div>
    </div>
  );
}
