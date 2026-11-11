"""Answer a question about one meeting ("Ask Fred"-style chat).

With an LLM key the question goes to Claude with the transcript. Without one,
a retrieval-based answer is built: intent shortcuts for common questions
(action items, summary, participants, decisions) and otherwise the most
relevant transcript lines ranked by term overlap weighted by rarity.
"""
import math
import re
from collections import Counter

from ..models import Meeting
from ..schemas import AskResponse, Citation
from . import llm
from .summarizer import STOPWORDS, _fmt_ts

_SYNONYMS = {
    "price": {"pricing", "cost", "costs", "plan", "plans", "discount"},
    "pricing": {"price", "cost", "plan", "discount"},
    "deadline": {"date", "due", "launch", "ship", "release", "timeline"},
    "timeline": {"date", "deadline", "launch", "quarter", "week"},
    "problem": {"issue", "bug", "risk", "blocker", "concern"},
    "risk": {"concern", "blocker", "issue", "worried"},
    "customer": {"customers", "client", "account", "accounts"},
}


def _terms(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9']+", text.lower()) if t not in STOPWORDS and len(t) > 2]


def _stem(t: str) -> str:
    return re.sub(r"(ing|ed|es|s)$", "", t) if len(t) > 4 else t


def _citation(seg) -> Citation:
    return Citation(
        segment_id=seg.id,
        start_ms=seg.start_ms,
        speaker=seg.speaker.name if seg.speaker else None,
        text=seg.text,
    )


def _rank_segments(meeting: Meeting, question: str, k: int = 4):
    q_terms = {_stem(t) for t in _terms(question)}
    for t in list(q_terms):
        q_terms |= {_stem(s) for s in _SYNONYMS.get(t, set())}
    if not q_terms:
        return []
    docs = [{_stem(t) for t in _terms(s.text)} for s in meeting.segments]
    df = Counter(t for d in docs for t in d)
    n = len(docs) or 1
    scored = []
    for seg, d in zip(meeting.segments, docs):
        hit = q_terms & d
        if hit:
            score = sum(math.log(1 + n / df[t]) for t in hit) / math.sqrt(len(d) + 1)
            scored.append((score, seg))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:k]]


def _rules_answer(meeting: Meeting, question: str) -> AskResponse:
    q = question.lower()
    by_id = {s.id: s for s in meeting.segments}

    if re.search(r"\b(action items?|tasks?|to-?dos?|next steps|follow[- ]ups?|assigned)\b", q):
        items = meeting.action_items
        if not items:
            return AskResponse(answer="No action items were captured for this meeting.", citations=[], generated_by="rules")
        lines = []
        cites = []
        for a in items:
            who = f" ({a.assignee.name})" if a.assignee else ""
            done = " [done]" if a.completed else ""
            lines.append(f"- {a.text}{who}{done}")
            if a.source_start_ms is not None:
                seg = min(meeting.segments, key=lambda s: abs(s.start_ms - a.source_start_ms), default=None)
                if seg:
                    cites.append(_citation(seg))
        return AskResponse(
            answer=f"{len(items)} action items came out of this meeting:\n" + "\n".join(lines),
            citations=cites[:4],
            generated_by="rules",
        )

    if re.search(r"\b(summar|overview|tl;?dr|about|recap|gist)\w*\b", q) and meeting.summary:
        return AskResponse(answer=meeting.summary.overview, citations=[], generated_by="rules")

    if re.search(r"\b(who (attended|was there|joined|spoke)|participants|attendees|speakers?)\b", q):
        # Same formula as the speaker panel (services.meetings.to_detail).
        talk = Counter()
        for s in meeting.segments:
            if s.speaker:
                talk[s.speaker.name] += max(0, s.end_ms - s.start_ms)
        total = sum(talk.values()) or 1
        parts = [f"{name} ({round(100 * ms / total)}%)" for name, ms in talk.most_common()]
        return AskResponse(
            answer=f"{len(meeting.participants)} people attended. Talk time: " + ", ".join(parts) + ".",
            citations=[],
            generated_by="rules",
        )

    top = _rank_segments(meeting, question)
    if re.search(r"\b(decid|decision|agree|conclu|settled)\w*\b", q):
        decision_segs = [
            s for s in meeting.segments
            if re.search(
                r"\b(decided|decision|let's (?:go with|do|ship|keep|lock)|agreed|we'll go|final call|the plan is|"
                r"we're going to|sounds like the plan|ship it|locked in|settled on|go ahead)\b",
                s.text,
                re.I,
            )
        ]
        top = list(dict.fromkeys(decision_segs[:4] + top))[:5]

    if not top:
        return AskResponse(
            answer="I couldn't find anything in this transcript about that. Try different keywords, "
                   "or ask about the summary, action items or participants.",
            citations=[],
            generated_by="rules",
        )
    ordered = sorted(top, key=lambda s: s.start_ms)
    bullets = "\n".join(
        f"- [{_fmt_ts(s.start_ms)}] {s.speaker.name if s.speaker else 'Speaker'}: \"{s.text}\"" for s in ordered
    )
    return AskResponse(
        answer=f"Here's what was said that relates to your question:\n{bullets}",
        citations=[_citation(by_id[s.id]) for s in ordered],
        generated_by="rules",
    )


def _llm_answer(meeting: Meeting, question: str) -> AskResponse | None:
    lines = "\n".join(
        f"[seg {s.id} @ {_fmt_ts(s.start_ms)}] {s.speaker.name if s.speaker else 'Unknown'}: {s.text}"
        for s in meeting.segments
    )
    data = llm.complete_json(
        "You answer questions about a single meeting using only its transcript. If the transcript "
        "does not contain the answer, say so plainly.",
        f"Meeting: {meeting.title}\n\nTranscript:\n{lines}\n\nQuestion: {question}\n\n"
        'Return {"answer": concise answer (markdown bullets allowed), "segment_ids": [ids of up to 4 supporting segments]}',
        max_tokens=2000,
    )
    if not data or not isinstance(data.get("answer"), str):
        return None
    by_id = {s.id: s for s in meeting.segments}
    cites = [_citation(by_id[i]) for i in data.get("segment_ids", []) if isinstance(i, int) and i in by_id]
    return AskResponse(answer=data["answer"].strip(), citations=cites[:4], generated_by="llm")


def answer_question(meeting: Meeting, question: str) -> AskResponse:
    if llm.is_enabled():
        result = _llm_answer(meeting, question)
        if result:
            return result
    return _rules_answer(meeting, question)
