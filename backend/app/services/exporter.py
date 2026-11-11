"""Render a meeting as Markdown or plain text for download."""
from ..models import Meeting
from .summarizer import _fmt_ts


def _header(m: Meeting) -> tuple[str, str]:
    when = m.started_at.strftime("%b %d, %Y %H:%M UTC")
    people = ", ".join(p.name for p in m.participants) or "-"
    return when, people


def to_markdown(m: Meeting) -> str:
    when, people = _header(m)
    out = [f"# {m.title}", "", f"**Date:** {when}  ", f"**Duration:** {m.duration_sec // 60} min  ",
           f"**Participants:** {people}", ""]
    if m.summary:
        out += ["## Overview", "", m.summary.overview, ""]
        if m.summary.keywords:
            out += [f"**Keywords:** {', '.join(m.summary.keywords)}", ""]
        if m.summary.notes:
            out += ["## Notes", ""] + [f"- {n}" for n in m.summary.notes] + [""]
    if m.chapters:
        out += ["## Outline", ""] + [f"- **{_fmt_ts(c.start_ms)} {c.title}** - {c.summary}" for c in m.chapters] + [""]
    if m.action_items:
        out += ["## Action items", ""]
        for a in m.action_items:
            who = f" (@{a.assignee.name})" if a.assignee else ""
            due = f" - due {a.due_date.isoformat()}" if a.due_date else ""
            out.append(f"- [{'x' if a.completed else ' '}] {a.text}{who}{due}")
        out.append("")
    out += ["## Transcript", ""]
    for s in m.segments:
        out.append(f"**{s.speaker.name if s.speaker else 'Speaker'}** `{_fmt_ts(s.start_ms)}`  ")
        out.append(s.text)
        out.append("")
    return "\n".join(out)


def to_text(m: Meeting) -> str:
    when, people = _header(m)
    out = [m.title, "=" * len(m.title), f"Date: {when}", f"Duration: {m.duration_sec // 60} min",
           f"Participants: {people}", ""]
    if m.summary:
        out += ["OVERVIEW", m.summary.overview, ""]
    if m.action_items:
        out += ["ACTION ITEMS"] + [
            f"[{'x' if a.completed else ' '}] {a.text}" + (f" ({a.assignee.name})" if a.assignee else "")
            for a in m.action_items
        ] + [""]
    out.append("TRANSCRIPT")
    out += [f"[{_fmt_ts(s.start_ms)}] {s.speaker.name if s.speaker else 'Speaker'}: {s.text}" for s in m.segments]
    return "\n".join(out) + "\n"
