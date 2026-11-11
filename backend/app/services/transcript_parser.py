"""Parse uploaded/pasted transcripts into timed, speaker-labelled segments.

Supported formats
- vtt:  WebVTT cues; speaker from `<v Name>` voice tags or a `Name:` prefix
- srt:  SubRip cues; speaker from a `Name:` prefix
- json: `[{"speaker", "start", "end"?, "text"}]` (seconds) or `{"segments": [...]}`;
        `start_ms`/`end_ms` are accepted too
- txt:  one utterance per line, e.g. `[00:01:05] Jane Doe: text`,
        `00:01:05 Jane Doe: text`, `Jane Doe (01:05): text` or plain `Jane Doe: text`.
        Lines without a speaker continue the previous utterance; missing
        timestamps are estimated from speaking rate.
"""
import json
import re
from dataclasses import dataclass

WORDS_PER_SECOND = 2.6  # ~155 wpm, a typical conversational pace


class TranscriptParseError(ValueError):
    pass


@dataclass
class ParsedSegment:
    speaker: str | None
    start_ms: int | None
    text: str
    end_ms: int | None = None


_TS = r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?"
_CUE_RE = re.compile(rf"^\s*{_TS}\s*-->\s*{_TS}")
_VOICE_RE = re.compile(r"<v(?:\.[^ >]+)?\s+([^>]+)>(.*?)(?:</v>)?$", re.IGNORECASE)
_TAG_RE = re.compile(r"</?[^>]+>")
_SPEAKER_PREFIX_RE = re.compile(r"^([A-Z][\w.'\- ]{0,40}?):\s+(.+)$")
_TXT_PATTERNS = [
    # [00:01:05] Name: text   |   00:01:05 Name: text   |   (01:05) Name: text
    re.compile(rf"^\s*[\[(]?{_TS}[\])]?\s*[-|]?\s*([^:\[\]()]{{1,60}}?):\s*(.+)$"),
    # Name [00:01:05]: text   |   Name (01:05): text   |   Name 01:05: text
    re.compile(rf"^\s*([^:\[\]()\d][^:\[\]()]{{0,59}}?)\s*[\[(]?{_TS}[\])]?\s*:?\s+(.+)$"),
]


def _to_ms(h, m, s, frac) -> int:
    frac_ms = int((frac or "0").ljust(3, "0")[:3])
    return ((int(h or 0) * 60 + int(m)) * 60 + int(s)) * 1000 + frac_ms


def detect_format(text: str, filename: str | None = None) -> str:
    if filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in {"vtt", "srt", "json", "txt"}:
            return ext
    head = text.lstrip()[:200]
    if head.startswith("WEBVTT"):
        return "vtt"
    if head.startswith(("[", "{")):
        try:
            json.loads(text)
            return "json"
        except json.JSONDecodeError:
            pass
    if re.search(r"^\d+\s*\n\s*\d{2}:\d{2}:\d{2},\d{3}\s*-->", text, re.MULTILINE):
        return "srt"
    return "txt"


def _parse_cues(text: str) -> list[ParsedSegment]:
    """Shared VTT/SRT cue parser."""
    out: list[ParsedSegment] = []
    blocks = re.split(r"\n\s*\n", text.replace("\r\n", "\n"))
    for block in blocks:
        lines = [ln for ln in block.strip().split("\n") if ln.strip()]
        cue_idx = next((i for i, ln in enumerate(lines) if _CUE_RE.match(ln)), None)
        if cue_idx is None:
            continue
        m = _CUE_RE.match(lines[cue_idx])
        g = m.groups()
        start, end = _to_ms(*g[0:4]), _to_ms(*g[4:8])
        body = " ".join(lines[cue_idx + 1:]).strip()
        speaker = None
        voice = _VOICE_RE.match(body)
        if voice:
            speaker, body = voice.group(1).strip(), voice.group(2)
        body = _TAG_RE.sub("", body).strip()
        if speaker is None:
            prefix = _SPEAKER_PREFIX_RE.match(body)
            if prefix:
                speaker, body = prefix.group(1).strip(), prefix.group(2).strip()
        if body:
            out.append(ParsedSegment(speaker, start, body, end))
    return out


def _parse_json(text: str) -> list[ParsedSegment]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise TranscriptParseError(f"Invalid JSON: {exc.msg}") from exc
    items = data.get("segments") if isinstance(data, dict) else data
    if not isinstance(items, list):
        raise TranscriptParseError('JSON must be a list of segments or {"segments": [...]}')
    out = []
    for item in items:
        if not isinstance(item, dict) or not str(item.get("text", "")).strip():
            continue

        def ms(key_s: str, key_ms: str) -> int | None:
            if item.get(key_ms) is not None:
                return int(item[key_ms])
            if item.get(key_s) is not None:
                return int(float(item[key_s]) * 1000)
            return None

        out.append(
            ParsedSegment(
                speaker=(item.get("speaker") or item.get("speaker_name") or None),
                start_ms=ms("start", "start_ms"),
                end_ms=ms("end", "end_ms"),
                text=str(item["text"]).strip(),
            )
        )
    return out


def _parse_txt(text: str) -> list[ParsedSegment]:
    out: list[ParsedSegment] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue
        parsed = None
        for i, pattern in enumerate(_TXT_PATTERNS):
            m = pattern.match(line)
            if m:
                g = m.groups()
                if i == 0:
                    parsed = ParsedSegment(g[4].strip(), _to_ms(*g[0:4]), g[5].strip())
                else:
                    parsed = ParsedSegment(g[0].strip(), _to_ms(*g[1:5]), g[5].strip())
                break
        if parsed is None:
            m = _SPEAKER_PREFIX_RE.match(line)
            if m:
                parsed = ParsedSegment(m.group(1).strip(), None, m.group(2).strip())
        if parsed is not None:
            out.append(parsed)
        elif out:
            out[-1].text = f"{out[-1].text} {line}"  # continuation line
        else:
            out.append(ParsedSegment(None, None, line))
    return out


def _fill_timing(segments: list[ParsedSegment]) -> list[ParsedSegment]:
    """Estimate missing starts, then derive each end from the next start."""
    cursor = 0
    for seg in segments:
        est = int(len(seg.text.split()) / WORDS_PER_SECOND * 1000) + 600
        if seg.start_ms is None or seg.start_ms < cursor:
            seg.start_ms = cursor
        cursor = seg.start_ms + est
    for i, seg in enumerate(segments):
        nxt = segments[i + 1].start_ms if i + 1 < len(segments) else None
        if seg.end_ms is None or seg.end_ms <= seg.start_ms:
            est = int(len(seg.text.split()) / WORDS_PER_SECOND * 1000) + 600
            seg.end_ms = min(nxt, seg.start_ms + est) if nxt and nxt > seg.start_ms else seg.start_ms + est
    return segments


def parse_transcript(text: str, fmt: str = "auto", filename: str | None = None) -> list[ParsedSegment]:
    if not text or not text.strip():
        raise TranscriptParseError("Transcript is empty")
    fmt = detect_format(text, filename) if fmt == "auto" else fmt
    parser = {"vtt": _parse_cues, "srt": _parse_cues, "json": _parse_json, "txt": _parse_txt}[fmt]
    segments = parser(text)
    if not segments:
        raise TranscriptParseError(f"No transcript lines could be read as {fmt.upper()}")
    for seg in segments:
        if seg.speaker:
            seg.speaker = re.sub(r"\s+", " ", seg.speaker).strip()[:120]
    return _fill_timing(segments)
