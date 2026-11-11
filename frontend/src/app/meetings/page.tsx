"use client";

import { ArrowDownUp, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import useSWR from "swr";
import { MeetingsList } from "@/components/meetings/MeetingsList";
import { EmptyState } from "@/components/ui/misc";
import { fetcher } from "@/lib/api";
import { cn } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";
import type { MeetingList, Participant, Tag } from "@/lib/types";

const PAGE_SIZE = 20;

const CHANNELS = [
  { id: "", label: "All Meetings" },
  { id: "upload", label: "Uploads" },
  { id: "shared", label: "Shared with me" },
] as const;

const DATE_PRESETS = [
  { id: "", label: "Any time", days: null },
  { id: "today", label: "Today", days: 0 },
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "14", label: "Last 14 days", days: 14 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "custom", label: "Custom range", days: null },
] as const;

const DURATIONS = [
  { id: "", label: "Any length", min: null, max: null },
  { id: "lt15", label: "Less than 15 mins", min: null, max: 15 },
  { id: "15-30", label: "15-30 mins", min: 15, max: 30 },
  { id: "30-60", label: "30-60 mins", min: 30, max: 60 },
  { id: "60+", label: "60+ mins", min: 60, max: null },
] as const;

const PLATFORMS = [
  { id: "", label: "Anywhere" },
  { id: "zoom", label: "Zoom" },
  { id: "google_meet", label: "Google Meet" },
  { id: "teams", label: "Microsoft Teams" },
  { id: "upload", label: "Uploads" },
];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function Pills<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: string; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            value === o.id ? "border-brand-500 bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "hover:border-brand-300",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MeetingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters live in the URL so views are shareable and survive refresh.
  const [q, setQ] = useState(params.get("q") ?? "");
  const debouncedQ = useDebounced(q);
  const channel = params.get("channel") ?? "";
  const participant = params.get("participant_id") ?? "";
  const tag = params.get("tag") ?? "";
  const datePreset = params.get("when") ?? "";
  const from = params.get("date_from") ?? "";
  const to = params.get("date_to") ?? "";
  const duration = params.get("duration") ?? "";
  const platform = params.get("platform") ?? "";
  const sort = params.get("sort") ?? "recent";
  const page = Number(params.get("page") ?? 1);

  const setParam = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in updates)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if ((params.get("q") ?? "") !== debouncedQ) setParam({ q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const query = new URLSearchParams({ sort, page: String(page), page_size: String(PAGE_SIZE) });
  if (debouncedQ) query.set("q", debouncedQ);
  if (channel === "upload") query.set("source", "upload");
  if (participant) query.set("participant_id", participant);
  if (tag) query.set("tag", tag);
  if (platform) query.set("platform", platform);
  const preset = DATE_PRESETS.find((p) => p.id === datePreset);
  if (preset && preset.days !== null) {
    const start = new Date();
    start.setDate(start.getDate() - preset.days);
    query.set("date_from", isoDay(start));
  } else if (datePreset === "custom") {
    if (from) query.set("date_from", from);
    if (to) query.set("date_to", to);
  }
  const dur = DURATIONS.find((d) => d.id === duration);
  if (dur?.min != null) query.set("min_minutes", String(dur.min));
  if (dur?.max != null) query.set("max_minutes", String(dur.max));

  const shared = channel === "shared";
  const { data, isLoading } = useSWR<MeetingList>(shared ? null : `/api/meetings?${query}`, fetcher, { keepPreviousData: true });
  const { data: people } = useSWR<Participant[]>("/api/participants", fetcher);
  const { data: tags } = useSWR<Tag[]>("/api/tags", fetcher);

  const activeFilters = [participant, tag, datePreset, duration, platform].filter(Boolean).length;
  const hasFilters = !!(debouncedQ || activeFilters);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const clearAll = () => {
    setQ("");
    router.replace(channel ? `${pathname}?channel=${channel}` : pathname);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Meetings</h1>
        <p className="mt-0.5 text-sm text-muted">
          {shared ? " " : data ? `${data.total} meeting${data.total === 1 ? "" : "s"}` : " "}
        </p>
      </div>

      {/* Channels */}
      <div className="mb-4 flex gap-1 border-b">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            onClick={() => setParam({ channel: c.id })}
            className={cn(
              "relative px-3 py-2 text-sm font-medium",
              channel === c.id ? "text-brand-700 dark:text-brand-300" : "text-muted hover:text-current",
            )}
          >
            {c.label}
            {channel === c.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or participant"
            className="h-9 w-full rounded-lg border bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/20"
          />
        </div>

        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-surface px-3 text-sm",
            (filtersOpen || activeFilters > 0) && "border-brand-400 text-brand-700 dark:text-brand-300",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {activeFilters > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{activeFilters}</span>}
        </button>

        <label className="relative">
          <span className="sr-only">Sort</span>
          <ArrowDownUp className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <select
            value={sort}
            onChange={(e) => setParam({ sort: e.target.value === "recent" ? "" : e.target.value })}
            className="h-9 cursor-pointer appearance-none rounded-lg border bg-surface pl-8 pr-7 text-sm outline-none focus:border-brand-400"
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest</option>
            <option value="title">Title A-Z</option>
          </select>
        </label>

        {hasFilters && (
          <button onClick={clearAll} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-current">
            <X className="h-3.5 w-3.5" /> Clear all filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-5 grid gap-5 rounded-xl border bg-surface p-4 md:grid-cols-2">
          <FilterGroup title="Date range">
            <Pills options={DATE_PRESETS} value={datePreset} onChange={(v) => setParam({ when: v, date_from: "", date_to: "" })} />
            {datePreset === "custom" && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <input type="date" aria-label="From date" value={from} onChange={(e) => setParam({ date_from: e.target.value })} className="h-8 rounded-md border bg-surface px-2" />
                <span className="text-muted">to</span>
                <input type="date" aria-label="To date" value={to} onChange={(e) => setParam({ date_to: e.target.value })} className="h-8 rounded-md border bg-surface px-2" />
              </div>
            )}
          </FilterGroup>
          <FilterGroup title="Duration">
            <Pills options={DURATIONS} value={duration} onChange={(v) => setParam({ duration: v })} />
          </FilterGroup>
          <FilterGroup title="Captured from">
            <Pills options={PLATFORMS} value={platform} onChange={(v) => setParam({ platform: v })} />
          </FilterGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <FilterGroup title="Participants">
              <select value={participant} onChange={(e) => setParam({ participant_id: e.target.value })} className="h-8 w-full rounded-md border bg-surface px-2 text-sm" aria-label="Participant">
                <option value="">Anyone</option>
                {people?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup title="Tags">
              <select value={tag} onChange={(e) => setParam({ tag: e.target.value })} className="h-8 w-full rounded-md border bg-surface px-2 text-sm" aria-label="Tag">
                <option value="">Any tag</option>
                {tags?.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </FilterGroup>
          </div>
        </div>
      )}

      {shared ? (
        <div className="rounded-xl border bg-surface">
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Nothing shared with you yet"
            message="Team sharing and collaboration are coming soon. Meetings your teammates share will appear here."
          />
        </div>
      ) : (
        <MeetingsList
          meetings={data?.items}
          loading={isLoading}
          grouped={sort === "recent" || sort === "oldest"}
          onTagClick={(t) => setParam({ tag: t })}
        />
      )}

      {!shared && pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setParam({ page: String(page - 1) })} className="rounded-lg border bg-surface px-3 py-1.5 disabled:opacity-40">
            Previous
          </button>
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <button disabled={page >= pages} onClick={() => setParam({ page: String(page + 1) })} className="rounded-lg border bg-surface px-3 py-1.5 disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <MeetingsPage />
    </Suspense>
  );
}
