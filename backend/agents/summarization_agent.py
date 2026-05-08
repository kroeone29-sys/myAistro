"""
Summarization Agent (SOT v1)

Purpose:
- Converts raw lesson text into structured knowledge artifacts
- Must behave like a deterministic transformer, NOT a chatbot

Key rule:
- ALWAYS return valid structured JSON (never free-form text)
"""

import ollama
import json
import re
from datetime import datetime

from core.code_format import format_code_block
from core.model_router import SUMMARIZE as MODEL


def summarize_lesson(raw_text: str) -> dict:
    """
    Takes raw lesson text and returns structured summary output.
    This is a core SOT transformation node.
    """

    # -----------------------------
    # Guard clause: empty input
    # -----------------------------
    if not raw_text or not raw_text.strip():
        return {
            "summary": "Empty lesson input.",
            "key_concepts": [],
            "definitions": [],
            "code_blocks": [],
            "generated_at": datetime.utcnow().isoformat()
        }

    # -----------------------------
    # OUTPUT CONTRACT PROMPT
    # -----------------------------
    # Tight on purpose. An earlier, much longer prompt loaded llama3:8b
    # with so many instruction sections that it produced malformed output
    # on long lessons (observed reliably on the "HTML forms and user
    # input" lesson). Shorter prompt + JSON repair on the response
    # produces complete output for the same lessons.
    prompt = f"""Return a single JSON object summarizing the lesson below. The object MUST have exactly these keys:

- "summary": 2-4 sentences of plain-English prose explaining the lesson's main ideas. Do NOT just restate the title.
- "key_concepts": array of short noun phrases (1-5 words each) for the ideas the lesson covers.
- "definitions": array of "term — explanation" pairs for terms the lesson formally defines. Each entry must contain BOTH the term and its explanation. Empty array if the lesson defines nothing.
- "code_blocks": array of complete code examples copied VERBATIM from the lesson, preserving line breaks and indentation. Each entry is one full example (an HTML document is one entry, not one entry per tag). Empty array if the lesson has no code.

Return ONLY the JSON object. No markdown fences, no commentary, no prose around it.

LESSON:
{raw_text}
"""

    # -----------------------------
    # CALL LLM
    # -----------------------------
    # Note: NOT using format="json". The grammar-constrained mode
    # consistently bailed mid-output on llama3:8b for lessons containing
    # HTML/JSX in code blocks (observed reliably on "HTML forms and user
    # input" — model stopped right after emitting "<form>" inside a code
    # string). Letting the model generate freely + parsing/repairing
    # afterward produces complete output for those lessons. The prompt
    # below still demands strict JSON, and _parse_or_repair handles any
    # rough edges.
    response = ollama.chat(
        model=MODEL,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        options={
            "num_ctx": 8192,
            "num_predict": 3072,
            "temperature": 0.1,
        }
    )

    output_text = response["message"]["content"]

    # -----------------------------
    # PARSE + VALIDATE OUTPUT
    # -----------------------------
    parsed = _parse_or_repair(output_text)
    if not parsed:
        # Total failure — preserve the raw output so the user / log can
        # inspect what the model actually emitted.
        parsed = {
            "summary": output_text,
            "key_concepts": [],
            "definitions": [],
            "code_blocks": [],
        }

    # -----------------------------
    # FINAL STANDARDIZED OUTPUT
    # -----------------------------
    # The LLM occasionally violates the JSON contract — e.g. emits
    # code_blocks as [{"language": "...", "code": "..."}] instead of
    # ["string"]. Coerce every field to its expected shape before
    # downstream code (validation, memory writer) touches it.
    return {
        "summary": _ensure_str(parsed.get("summary")),
        "key_concepts": _ensure_list_of_str(parsed.get("key_concepts")),
        "definitions": _ensure_list_of_str(parsed.get("definitions")),
        "code_blocks": [
            format_code_block(b)
            for b in _ensure_list_of_str(parsed.get("code_blocks"))
        ],
        "generated_at": datetime.utcnow().isoformat(),
    }


def _parse_or_repair(text: str):
    """
    Parse LLM JSON output, repairing truncated responses where possible.

    Real-world failure mode: Ollama's format="json" can stop generation
    mid-string on long inputs (observed with llama3:8b at 8-9k char
    lessons even with a 3072-token output cap). The model never closed
    the JSON object, so json.loads fails and the user loses the entry.

    Repair strategy: walk the text, track whether we're inside a string,
    track bracket nesting, then synthesize the missing closers.
    """
    if not text:
        return None

    text = text.strip()

    # Try direct parse first.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip anything before the first '{' — sometimes the model prefixes
    # output with a stray newline or commentary.
    start = text.find("{")
    if start < 0:
        return None
    body = text[start:]

    # Scan to find string + bracket state at the end of the response.
    in_string = False
    escape_next = False
    stack = []
    for ch in body:
        if escape_next:
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in "[{":
            stack.append(ch)
        elif ch in "]}":
            if stack and ((ch == "}" and stack[-1] == "{") or
                          (ch == "]" and stack[-1] == "[")):
                stack.pop()

    repaired = body.rstrip()
    if in_string:
        repaired += '"'
    # Drop trailing commas/whitespace immediately before we add closers.
    repaired = re.sub(r"[,\s]+$", "", repaired)
    while stack:
        last = stack.pop()
        repaired += "}" if last == "{" else "]"
    # Also drop trailing commas inside nested closers.
    repaired = re.sub(r",\s*([}\]])", r"\1", repaired)

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        return None


def _ensure_str(value) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    if isinstance(value, dict):
        # Try common payload keys an LLM might use for the actual text.
        for key in ("text", "content", "value", "code", "summary"):
            v = value.get(key)
            if isinstance(v, str):
                return v
        return json.dumps(value)
    if isinstance(value, list):
        return " ".join(_ensure_str(v) for v in value)
    return str(value)


def _ensure_list_of_str(value) -> list:
    if isinstance(value, list):
        return [_ensure_str(v) for v in value]
    if isinstance(value, dict):
        return [_ensure_str(v) for v in value.values()]
    if isinstance(value, str):
        return [value] if value.strip() else []
    if value is None:
        return []
    return [_ensure_str(value)]
