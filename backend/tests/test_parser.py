import pytest

from app.services.transcript_parser import TranscriptParseError, detect_format, parse_transcript


def test_txt_with_timestamps_and_continuations():
    segs = parse_transcript(
        "[00:00:05] Jane Doe: Hello everyone.\nThis continues the line.\n[00:01:10] Sam Lee: Hi Jane."
    )
    assert [s.speaker for s in segs] == ["Jane Doe", "Sam Lee"]
    assert segs[0].start_ms == 5000 and segs[1].start_ms == 70000
    assert segs[0].text.endswith("This continues the line.")
    assert segs[0].end_ms <= segs[1].start_ms


def test_txt_without_timestamps_estimates_timing():
    segs = parse_transcript("Jane: one two three four five\nSam: six seven")
    assert segs[0].start_ms == 0
    assert segs[1].start_ms > 0


def test_vtt_voice_tags():
    text = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.500\n<v Ana Gomez>Welcome to the call.</v>\n\n" \
           "00:00:05.000 --> 00:00:07.000\nBo: Thanks!"
    segs = parse_transcript(text)
    assert detect_format(text) == "vtt"
    assert [(s.speaker, s.start_ms, s.end_ms) for s in segs] == [("Ana Gomez", 1000, 4500), ("Bo", 5000, 7000)]


def test_srt():
    text = "1\n00:00:01,000 --> 00:00:02,000\nAna: Hi\n\n2\n00:00:03,000 --> 00:00:04,000\nBo: Hello"
    assert detect_format(text) == "srt"
    assert [s.speaker for s in parse_transcript(text)] == ["Ana", "Bo"]


def test_json_seconds_and_ms():
    segs = parse_transcript('{"segments": [{"speaker": "A", "start": 1.5, "text": "x"}, '
                            '{"speaker": "B", "start_ms": 4000, "text": "y"}]}')
    assert [s.start_ms for s in segs] == [1500, 4000]


def test_empty_raises():
    with pytest.raises(TranscriptParseError):
        parse_transcript("   ")
