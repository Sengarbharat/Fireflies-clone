"""Thin wrapper around the Anthropic SDK.

Every caller treats the LLM as optional: `complete()` returns None when no key
is configured or the call fails, and the caller falls back to rules.
"""
import json
import logging
import re

from ..config import get_settings

log = logging.getLogger(__name__)


def is_enabled() -> bool:
    return bool(get_settings().anthropic_api_key)


def complete(system: str, user: str, max_tokens: int = 4000) -> str | None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=60.0)
        response = client.beta.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            # Short, well-specified tasks: low effort keeps latency down.
            output_config={"effort": "low"},
            # If the model declines, let the API route to a suitable fallback.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except Exception:  # network, auth, rate limit... never break the request
        log.exception("LLM call failed; falling back to rules")
        return None

    if response.stop_reason == "refusal":
        return None
    text = "".join(b.text for b in response.content if b.type == "text").strip()
    return text or None


def complete_json(system: str, user: str, max_tokens: int = 4000) -> dict | None:
    """Ask for a JSON object and parse it; None on any failure."""
    raw = complete(system + "\nRespond with a single JSON object and nothing else.", user, max_tokens)
    if not raw:
        return None
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    try:
        return json.loads(match.group(0)) if match else None
    except json.JSONDecodeError:
        return None
