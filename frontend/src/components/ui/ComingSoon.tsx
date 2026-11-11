import { Rocket } from "lucide-react";

export function ComingSoon({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features?: { name: string; detail: string }[];
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-0.5 text-sm text-muted">{description}</p>
      <div className="mt-6 rounded-2xl border border-dashed bg-surface p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <Rocket className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold">Coming soon</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">This area is a placeholder in the demo.</p>
      </div>
      {features && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.name} className="rounded-xl border bg-surface p-4 opacity-80">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{f.name}</span>
                <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium text-muted dark:bg-white/10">Soon</span>
              </div>
              <p className="mt-1 text-xs text-muted">{f.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
