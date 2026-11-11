import { formatDateTime, formatDuration, formatTimestamp } from "@/lib/format";
import type { MeetingDetail } from "@/lib/types";

/** Static document used for "Export > PDF" (browser print). Hidden on screen. */
export function PrintView({ meeting }: { meeting: MeetingDetail }) {
  const s = meeting.summary;
  return (
    <article className="hidden p-8 text-[12px] leading-relaxed text-black print:block">
      <h1 className="text-2xl font-bold">{meeting.title}</h1>
      <p className="mt-1 text-zinc-600">
        {formatDateTime(meeting.started_at)} &middot; {formatDuration(meeting.duration_sec)} &middot;{" "}
        {meeting.participants.map((p) => p.name).join(", ")}
      </p>
      {s && (
        <>
          <h2 className="mt-6 text-base font-semibold">Overview</h2>
          <p>{s.overview}</p>
          {s.notes.length > 0 && (
            <>
              <h2 className="mt-4 text-base font-semibold">Notes</h2>
              <ul className="list-disc pl-5">
                {s.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {meeting.action_items.length > 0 && (
        <>
          <h2 className="mt-4 text-base font-semibold">Action items</h2>
          <ul className="pl-1">
            {meeting.action_items.map((a) => (
              <li key={a.id}>
                {a.completed ? "☑" : "☐"} {a.text}
                {a.assignee ? ` (${a.assignee.name})` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="mt-6 text-base font-semibold">Transcript</h2>
      {meeting.segments.map((seg) => (
        <p key={seg.id} className="mt-1.5 break-inside-avoid">
          <span className="font-semibold">{seg.speaker?.name ?? "Speaker"}</span>{" "}
          <span className="font-mono text-zinc-500">{formatTimestamp(seg.start_ms)}</span>
          <br />
          {seg.text}
        </p>
      ))}
    </article>
  );
}
