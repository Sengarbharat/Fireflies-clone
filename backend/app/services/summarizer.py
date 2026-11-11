"""Generate a meeting summary, outline (chapters) and action items from a transcript.

Two interchangeable strategies return the same `GeneratedNotes`:
- `llm`   - Claude, used only when ANTHROPIC_API_KEY is set
- `rules` - a deterministic extractive summarizer (keyword frequency, sentence
            scoring, commitment-phrase detection), used otherwise or as fallback
"""
import math
import re
from collections import Counter
from dataclasses import dataclass, field

from . import llm

STOPWORDS = set(
    """a about above after again against all also am an and any are aren't as at be because been
    before being below between both but by can can't cannot could couldn't did didn't do does
    doesn't doing don't down during each few for from further get got gonna had hadn't has hasn't
    have haven't having he he'd he'll he's her here here's hers herself him himself his how how's
    i i'd i'll i'm i've if in into is isn't it it's its itself just know let's like maybe me might
    more most mustn't my myself need no nor not now of off oh ok okay on once one only or other
    ought our ours ourselves out over own pretty really right same say says see shan't she she'd
    she'll she's should shouldn't so some something such sure than that that's the their theirs
    them themselves then there there's these they they'd they'll they're they've thing things think
    this those through to too um uh under until up us very was wasn't we we'd we'll we're we've
    well were weren't what what's when when's where where's which while who who's whom why why's
    will with won't would wouldn't yeah yes yep you you'd you'll you're you've your yours yourself
    yourselves actually basically go going want wanted kind lot mean great good thanks thank
    probably definitely give take make made look looks looking still even back around every
    already though anything everything someone everyone guys today week next last time quick
    sounds hey hi able first second percent minutes""".split()
) | set(
    # number words and weekdays carry no topic signal for keywords/titles
    """zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen
    sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred
    thousand million half monday tuesday wednesday thursday friday saturday sunday""".split()
)
WEEKDAYS = r"(?:monday|tuesday|wednesday|thursday|friday|tomorrow|end of (?:the )?(?:day|week|month|sprint))"
COMMITMENT_RE = re.compile(
    r"\b(i'll|i will|i can take|i'm going to|we'll|we will|we need to|we should|let's|"
    r"can you|could you|would you mind|action item|follow up|follow-up|next step|"
    r"make sure|send (?:over|out)|share (?:the|a)|schedule|set up)\b",
    re.IGNORECASE,
)
FILLER_RE = re.compile(
    r"^(?:(?:so|okay|ok|yeah|yes|yep|right|alright|um|uh|and|well|great|cool|perfect|sure|honestly|look|got it)[,.!]?\s+)+",
    re.IGNORECASE,
)


@dataclass
class TranscriptLine:
    speaker: str | None
    start_ms: int
    text: str


@dataclass
class GeneratedChapter:
    title: str
    start_ms: int
    summary: str


@dataclass
class GeneratedActionItem:
    text: str
    assignee: str | None
    start_ms: int | None


@dataclass
class GeneratedNotes:
    overview: str
    notes: list[str]
    keywords: list[str]
    chapters: list[GeneratedChapter] = field(default_factory=list)
    action_items: list[GeneratedActionItem] = field(default_factory=list)
    generated_by: str = "rules"


# --- helpers -----------------------------------------------------------------
def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z][a-z0-9'\-]+", text.lower()) if t not in STOPWORDS and len(t) > 2]


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def _fmt_ts(ms: int) -> str:
    s = ms // 1000
    return f"{s // 3600:d}:{s // 60 % 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60:02d}:{s % 60:02d}"


def _join_human(items: list[str]) -> str:
    items = [i for i in items if i]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _clean(sentence: str) -> str:
    s = FILLER_RE.sub("", sentence).strip()
    return s[:1].upper() + s[1:] if s else s


def _keywords(lines: list[TranscriptLine], exclude: set[str], limit: int = 8) -> list[str]:
    unigrams: Counter[str] = Counter()
    bigrams: Counter[str] = Counter()
    for line in lines:
        toks = [t for t in _tokens(line.text) if t not in exclude]
        unigrams.update(toks)
        bigrams.update(f"{a} {b}" for a, b in zip(toks, toks[1:]))
    picked: list[str] = []
    for phrase, n in bigrams.most_common(30):
        if n >= 2 and len(picked) < limit // 2:
            picked.append(phrase)
    covered = {w for p in picked for w in p.split()}
    for word, _ in unigrams.most_common(60):
        if len(picked) >= limit:
            break
        if word not in covered:
            picked.append(word)
    return picked


def _score_sentences(lines: list[TranscriptLine], weights: Counter[str]):
    """Yield (score, line_index, sentence) for informative sentences."""
    for idx, line in enumerate(lines):
        for sent in _sentences(line.text):
            words = sent.split()
            if len(words) < 7 or sent.endswith("?"):
                continue
            toks = _tokens(sent)
            if not toks:
                continue
            score = sum(weights[t] for t in toks) / math.sqrt(len(words))
            if re.search(r"\d", sent):
                score *= 1.2  # numbers/dates are usually substantive
            yield score, idx, sent


# --- rules strategy ----------------------------------------------------------
def _rules(lines: list[TranscriptLine], participants: list[str], duration_ms: int) -> GeneratedNotes:
    name_tokens = {t.lower() for p in participants for t in p.split()}
    name_tokens |= {t.lower() for ln in lines if ln.speaker for t in ln.speaker.split()}
    keywords = _keywords(lines, name_tokens)

    weights: Counter[str] = Counter()
    for ln in lines:
        weights.update(t for t in _tokens(ln.text) if t not in name_tokens)

    scored = sorted(_score_sentences(lines, weights), reverse=True)

    # Notes: the strongest sentences, in meeting order, attributed to speakers.
    seen_idx: set[int] = set()
    notes_raw = []
    for score, idx, sent in scored:
        if idx in seen_idx:
            continue
        seen_idx.add(idx)
        notes_raw.append((idx, sent))
        if len(notes_raw) >= 7:
            break
    notes = [
        f"{lines[i].speaker.split()[0]}: {_clean(s)}" if lines[i].speaker else _clean(s)
        for i, s in sorted(notes_raw)
    ]

    # Chapters: split the meeting into equal-time windows, title each by its
    # most distinctive keywords and summarize by its best sentence.
    n_chapters = max(2, min(6, round(duration_ms / 1000 / 300) or 2))
    n_chapters = min(n_chapters, max(1, len(lines) // 3))
    chapters: list[GeneratedChapter] = []
    window = max(1, math.ceil(len(lines) / n_chapters))
    used_titles: set[str] = set()
    for c in range(n_chapters):
        chunk = lines[c * window:(c + 1) * window]
        if not chunk:
            continue
        local = Counter(t for ln in chunk for t in _tokens(ln.text) if t not in name_tokens)
        local_bi = Counter()
        for ln in chunk:
            toks = [t for t in _tokens(ln.text) if t not in name_tokens]
            local_bi.update(f"{a} {b}" for a, b in zip(toks, toks[1:]) if a != b)
        phrase = next((p for p, n in local_bi.most_common(5) if n >= 2 and p not in used_titles), None)
        if phrase:
            title = phrase.replace("-", " ").title()
            used_titles.add(phrase)
        else:
            # tf-idf-ish: prefer words frequent here but not everywhere
            ranked = sorted(local, key=lambda w: local[w] / (1 + weights[w] - local[w]) * local[w], reverse=True)
            words = [w for w in ranked if w not in used_titles][:2] or ranked[:1] or ["discussion"]
            used_titles.update(words)
            title = " & ".join(w.replace("-", " ").title() for w in words)
        best = max(_score_sentences(chunk, weights), default=None)
        chapters.append(
            GeneratedChapter(
                title=title,
                start_ms=chunk[0].start_ms,
                summary=_clean(best[2]) if best else _clean(chunk[0].text)[:200],
            )
        )

    # Action items: sentences that contain a commitment phrase.
    actions: list[GeneratedActionItem] = []
    seen_text: set[str] = set()
    for idx, line in enumerate(lines):
        for sent in _sentences(line.text):
            if not COMMITMENT_RE.search(sent) or len(sent.split()) < 5 or len(sent.split()) > 40:
                continue
            low = sent.lower()
            if sent.endswith("?") and not re.search(r"\b(can you|could you|would you mind)\b", low):
                continue
            assignee = None
            if re.search(r"\b(i'll|i will|i can take|i'm going to)\b", low):
                assignee = line.speaker
            elif re.search(r"\b(can you|could you|would you mind)\b", low):
                nxt = lines[idx + 1].speaker if idx + 1 < len(lines) else None
                assignee = nxt if nxt and nxt != line.speaker else None
            mentioned = next(
                (p for p in participants if re.search(rf"\b{re.escape(p.split()[0])}\b", sent)), None
            )
            assignee = assignee or mentioned
            text = _clean(sent).rstrip("?.!") + "."
            key = re.sub(r"\W+", " ", text.lower())[:60]
            if key in seen_text:
                continue
            seen_text.add(key)
            due = re.search(rf"\b(?:by|on|before)\s+{WEEKDAYS}\b", low)
            weight = (2 if assignee else 0) + (1 if due else 0) + (1 if re.search(r"\d", sent) else 0)
            actions.append((weight, idx, GeneratedActionItem(text, assignee, line.start_ms)))
    actions.sort(key=lambda a: (-a[0], a[1]))
    action_items = [a for _, _, a in sorted(actions[:7], key=lambda a: a[1])]

    # Overview: a templated paragraph grounded in the stats above.
    talk = Counter()
    for i, ln in enumerate(lines):
        end = lines[i + 1].start_ms if i + 1 < len(lines) else duration_ms
        if ln.speaker:
            talk[ln.speaker] += max(0, end - ln.start_ms)
    speakers = [s for s, _ in talk.most_common()]
    minutes = max(1, round(duration_ms / 60000))
    parts = [
        f"{_join_human([s.split()[0] for s in speakers[:5]]) or 'The team'} met for about "
        f"{minutes} minute{'s' if minutes != 1 else ''} to discuss {_join_human(keywords[:3]) or 'several topics'}."
    ]
    if speakers and sum(talk.values()):
        pct = round(100 * talk[speakers[0]] / sum(talk.values()))
        parts.append(f"{speakers[0]} led the conversation with about {pct}% of the talk time.")
    if len(chapters) > 1:
        parts.append(f"The discussion moved through {_join_human([c.title.lower() for c in chapters[:4]])}.")
    if action_items:
        first = action_items[0]
        who = f" for {first.assignee.split()[0]}" if first.assignee else ""
        parts.append(
            f"{len(action_items)} follow-up{'s were' if len(action_items) != 1 else ' was'} captured, "
            f"including \"{first.text.rstrip('.')}\"{who}."
        )
    return GeneratedNotes(" ".join(parts), notes, keywords, chapters, action_items, "rules")


# --- llm strategy ------------------------------------------------------------
_LLM_SYSTEM = (
    "You write meeting notes for a meeting-assistant app. Be faithful to the transcript: "
    "never invent facts, names or numbers. Use the exact speaker names that appear in the transcript."
)
_LLM_FORMAT = """Return JSON with these keys:
"overview": 3-5 sentence paragraph,
"notes": 5-8 concise bullet sentences,
"keywords": 5-8 short keywords,
"chapters": 3-6 items {"title": short title, "start_seconds": number taken from a line timestamp, "summary": 1-2 sentences},
"action_items": 0-7 items {"text": imperative task, "assignee": speaker name or null, "start_seconds": number}"""


def _llm(lines: list[TranscriptLine]) -> GeneratedNotes | None:
    transcript = "\n".join(
        f"[{ln.start_ms // 1000}s] {ln.speaker or 'Unknown'}: {ln.text}" for ln in lines
    )
    if len(transcript) > 400_000:  # far beyond any real meeting; keep rules output
        return None
    data = llm.complete_json(_LLM_SYSTEM, f"{_LLM_FORMAT}\n\nTranscript:\n{transcript}")
    if not data or not isinstance(data.get("overview"), str):
        return None

    def secs(v) -> int | None:
        try:
            return int(float(v) * 1000)
        except (TypeError, ValueError):
            return None

    return GeneratedNotes(
        overview=data["overview"].strip(),
        notes=[str(n).strip() for n in data.get("notes", []) if str(n).strip()],
        keywords=[str(k).strip() for k in data.get("keywords", []) if str(k).strip()],
        chapters=[
            GeneratedChapter(str(c.get("title", "")).strip() or "Discussion", secs(c.get("start_seconds")) or 0,
                             str(c.get("summary", "")).strip())
            for c in data.get("chapters", []) if isinstance(c, dict)
        ],
        action_items=[
            GeneratedActionItem(str(a.get("text", "")).strip(), a.get("assignee") or None, secs(a.get("start_seconds")))
            for a in data.get("action_items", []) if isinstance(a, dict) and a.get("text")
        ],
        generated_by="llm",
    )


def generate_notes(lines: list[TranscriptLine], participants: list[str], duration_ms: int) -> GeneratedNotes:
    if not lines:
        return GeneratedNotes("No transcript available yet.", [], [], [], [], "rules")
    if llm.is_enabled():
        result = _llm(lines)
        if result:
            return result
    return _rules(lines, participants, duration_ms)


__all__ = ["GeneratedNotes", "TranscriptLine", "generate_notes", "_fmt_ts"]
