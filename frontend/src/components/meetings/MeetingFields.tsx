"use client";

import useSWR from "swr";
import { ChipsInput } from "@/components/ui/ChipsInput";
import { fetcher } from "@/lib/api";
import type { Participant, Platform, Tag } from "@/lib/types";

export interface MeetingFieldValues {
  title: string;
  date: string; // value of <input type="datetime-local">
  platform: Platform;
  participants: string[];
  tags: string[];
}

export const inputClass =
  "h-10 w-full rounded-lg border bg-surface px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-500/20";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

/** "2026-11-03T15:00:00Z" -> "2026-11-03T08:00" in the viewer's local time. */
export function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function MeetingFields({
  values,
  onChange,
  showPlatform = true,
}: {
  values: MeetingFieldValues;
  onChange: (v: MeetingFieldValues) => void;
  showPlatform?: boolean;
}) {
  const { data: people } = useSWR<Participant[]>("/api/participants", fetcher);
  const { data: tags } = useSWR<Tag[]>("/api/tags", fetcher);
  const set = <K extends keyof MeetingFieldValues>(k: K, v: MeetingFieldValues[K]) => onChange({ ...values, [k]: v });

  return (
    <div className="space-y-4">
      <Field label="Title">
        <input
          className={inputClass}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Weekly product sync"
          maxLength={255}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date & time">
          <input type="datetime-local" className={inputClass} value={values.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        {showPlatform && (
          <Field label="Source">
            <select className={inputClass} value={values.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
              <option value="upload">Upload</option>
              <option value="zoom">Zoom</option>
              <option value="google_meet">Google Meet</option>
              <option value="teams">Microsoft Teams</option>
            </select>
          </Field>
        )}
      </div>
      <Field label="Participants" hint="Press Enter or comma to add. Speakers found in the transcript are added automatically.">
        <ChipsInput
          value={values.participants}
          onChange={(v) => set("participants", v)}
          placeholder="Add people"
          suggestions={(people ?? []).map((p) => p.name)}
        />
      </Field>
      <Field label="Tags">
        <ChipsInput
          value={values.tags}
          onChange={(v) => set("tags", v)}
          placeholder="e.g. Product, Customer"
          suggestions={(tags ?? []).map((t) => t.name)}
        />
      </Field>
    </div>
  );
}
