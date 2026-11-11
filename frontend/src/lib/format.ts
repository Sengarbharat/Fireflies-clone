import { clsx, type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** 75_000 -> "01:15", 3_725_000 -> "1:02:05" */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 1840 -> "31 min", 45 -> "1 min", 4000 -> "1 hr 7 min" */
export function formatDuration(sec: number): string {
  const mins = Math.max(1, Math.round(sec / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...opts });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${d.toLocaleTimeString(
    "en-US",
    { hour: "numeric", minute: "2-digit" },
  )}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso, { year: undefined });
}

/** Group label used in the meetings list, Fireflies-style. */
export function dateGroupLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Earlier this week";
  if (days < 14) return "Last week";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Full class names (not built by string concatenation) so Tailwind can see them.
const PERSON_COLORS: { bg: string; text: string; hex: string }[] = [
  { bg: "bg-violet-500", text: "text-violet-600 dark:text-violet-400", hex: "#8b5cf6" },
  { bg: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", hex: "#0ea5e9" },
  { bg: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", hex: "#10b981" },
  { bg: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", hex: "#f59e0b" },
  { bg: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", hex: "#f43f5e" },
  { bg: "bg-cyan-600", text: "text-cyan-700 dark:text-cyan-400", hex: "#0891b2" },
  { bg: "bg-fuchsia-500", text: "text-fuchsia-600 dark:text-fuchsia-400", hex: "#d946ef" },
  { bg: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400", hex: "#6366f1" },
  { bg: "bg-teal-500", text: "text-teal-600 dark:text-teal-400", hex: "#14b8a6" },
  { bg: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", hex: "#f97316" },
];

function personColor(key: string | number | null | undefined) {
  const s = String(key ?? "?");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}

/** Stable color per person, so a speaker keeps the same color everywhere. */
export const colorFor = (key: string | number | null | undefined) => personColor(key).bg;
export const textColorFor = (key: string | number | null | undefined) => personColor(key).text;
export const hexColorFor = (key: string | number | null | undefined) => personColor(key).hex;

export const TAG_STYLES: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  lime: "bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300",
};

export const PLATFORM_LABEL: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  upload: "Uploaded",
};

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
