"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { fetcher } from "@/lib/api";
import { formatDate, formatTimestamp } from "@/lib/format";
import type { SearchResponse } from "@/lib/types";

function SearchResults() {
  const q = useSearchParams().get("q")?.trim() ?? "";
  const { data, isLoading } = useSWR<SearchResponse>(q ? `/api/search?q=${encodeURIComponent(q)}` : null, fetcher);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <h1 className="text-xl font-semibold">Search</h1>
      <p className="mt-0.5 text-sm text-muted">
        {q ? (
          <>
            {data ? `${data.total_meetings} meeting${data.total_meetings === 1 ? "" : "s"}` : "Searching"} matching{" "}
            <span className="font-medium text-[var(--text)]">&ldquo;{q}&rdquo;</span> in titles and transcripts
          </>
        ) : (
          "Type in the search bar above to search every transcript."
        )}
      </p>

      <div className="mt-5 space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

        {data && data.results.length === 0 && (
          <div className="rounded-xl border bg-surface">
            <EmptyState icon={<SearchX className="h-5 w-5" />} title="No matches" message="Try another word or a shorter phrase." />
          </div>
        )}

        {data?.results.map((r) => (
          <div key={r.meeting_id} className="rounded-xl border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/meetings/${r.meeting_id}`} className="text-sm font-semibold hover:text-brand-600 hover:underline">
                {r.meeting_title}
              </Link>
              <span className="shrink-0 text-xs text-muted">
                {formatDate(r.started_at)} &middot; {r.match_count} mention{r.match_count === 1 ? "" : "s"}
                {r.title_match && " · title match"}
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {r.matches.map((m) => (
                <Link
                  key={m.segment_id}
                  href={`/meetings/${r.meeting_id}?t=${m.start_ms}`}
                  className="flex gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <span className="w-12 shrink-0 pt-0.5 font-mono text-[11px] text-brand-600">{formatTimestamp(m.start_ms)}</span>
                  <span className="min-w-0">
                    {m.speaker && <span className="mr-1.5 font-medium">{m.speaker}:</span>}
                    {/* snippet is HTML-escaped by the API; only <mark> tags are added */}
                    <span className="text-muted" dangerouslySetInnerHTML={{ __html: m.snippet }} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
