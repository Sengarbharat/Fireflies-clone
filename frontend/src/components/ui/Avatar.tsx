import { cn, colorFor, initials } from "@/lib/format";
import type { Participant } from "@/lib/types";

const SIZES = { xs: "h-5 w-5 text-[9px]", sm: "h-7 w-7 text-[11px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };

export function Avatar({
  name,
  size = "sm",
  className,
  ring,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white",
        colorFor(name),
        SIZES[size],
        ring && "ring-2 ring-[var(--surface)]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = "sm" }: { people: Participant[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5" title={people.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ring-2 ring-[var(--surface)] dark:bg-zinc-700 dark:text-zinc-200",
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
