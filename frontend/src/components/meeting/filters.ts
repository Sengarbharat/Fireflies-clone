import type { Segment } from "@/lib/types";

/** "Smart filters" that slice the transcript by kind of content. */
export const SMART_FILTERS = {
  questions: { label: "Questions", test: (t: string) => /\?/.test(t) },
  tasks: {
    label: "Tasks",
    test: (t: string) =>
      /\b(i'll|i will|we'll|we need to|we should|let's|can you|could you|action item|follow up|next step|by (monday|tuesday|wednesday|thursday|friday|tomorrow|end of))\b/i.test(t),
  },
  metrics: { label: "Metrics", test: (t: string) => /\d|percent|\b(million|thousand|k)\b/i.test(t) },
  dates: {
    label: "Dates & times",
    test: (t: string) =>
      /\b(monday|tuesday|wednesday|thursday|friday|today|tomorrow|next week|this week|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|deadline|eod)\b/i.test(t),
  },
} as const;

export type SmartFilter = keyof typeof SMART_FILTERS;

export function countSmart(segments: Segment[], key: SmartFilter): number {
  return segments.filter((s) => SMART_FILTERS[key].test(s.text)).length;
}
