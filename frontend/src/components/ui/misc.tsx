import { Sparkles, Upload, Video } from "lucide-react";
import { cn, PLATFORM_LABEL, TAG_STYLES } from "@/lib/format";
import type { Tag } from "@/lib/types";

export function TagPill({ tag, className, onClick, active }: { tag: Tag; className?: string; onClick?: () => void; active?: boolean }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        TAG_STYLES[tag.color] ?? TAG_STYLES.violet,
        active && "ring-1 ring-current",
        className,
      )}
    >
      {tag.name}
    </Comp>
  );
}

/** Small brand-ish platform marks (simple shapes, not the vendors' logos). */
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const base = cn("inline-flex h-5 w-5 items-center justify-center rounded-md text-white", className);
  const label = PLATFORM_LABEL[platform] ?? platform;
  if (platform === "zoom")
    return (
      <span className={cn(base, "bg-[#2D8CFF]")} title={label}>
        <Video className="h-3 w-3" />
      </span>
    );
  if (platform === "google_meet")
    return (
      <span className={cn(base, "bg-[#00897B]")} title={label}>
        <Video className="h-3 w-3" />
      </span>
    );
  if (platform === "teams")
    return (
      <span className={cn(base, "bg-[#5059C9] text-[10px] font-bold")} title={label}>
        T
      </span>
    );
  return (
    <span className={cn(base, "bg-zinc-400 dark:bg-zinc-600")} title={label}>
      <Upload className="h-3 w-3" />
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-black/[0.06] dark:bg-white/[0.06]", className)} />;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15">
        {icon ?? <Sparkles className="h-5 w-5" />}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  // An original mark: a glowing dot with a trailing arc (a "firefly").
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="ff-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f472b6" />
          <stop offset="1" stopColor="#7c55fb" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ff-g)" />
      <path d="M8 21c3-8 9-11 16-11" stroke="#fff" strokeOpacity=".55" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="22.5" cy="11" r="4" fill="#fff" />
    </svg>
  );
}
