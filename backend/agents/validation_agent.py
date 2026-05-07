from datetime import datetime


# Source-text length above which we expect the LLM to extract key_concepts.
# Below this, a missing key_concepts list is acceptable.
NONTRIVIAL_SOURCE_CHARS = 200


def validate_summary(context: dict):
    """
    ======================================================
    VALIDATION AGENT (v3 - STRUCTURE + INTEGRITY)
    ======================================================

    PURPOSE:
    --------
    Gatekeeper that determines whether a summarization output
    is allowed to be persisted as a Source of Truth entry.

    CHECKS:
        1. structural shape (required fields present)
        2. summary is not raw JSON (catches the JSON-fallback path)
        3. key_concepts present when source is non-trivial
        4. weak grounding overlap with retrieval source_text
    """

    errors = []
    warnings = []

    retrieval = context.get("retrieval")
    summary = context.get("summarization")

    # -------------------------------------------------
    # BASIC SAFETY CHECK
    # -------------------------------------------------
    if not retrieval:
        errors.append("Missing retrieval context")

    if not summary:
        errors.append("Missing summarization output")

    if errors:
        return _fail(errors, warnings)

    # -------------------------------------------------
    # STRUCTURE VALIDATION
    # -------------------------------------------------
    required_fields = ["summary", "generated_at"]

    for field in required_fields:
        if field not in summary:
            errors.append(f"Missing field: {field}")

    summary_text = summary.get("summary", "")
    key_concepts = summary.get("key_concepts", [])
    source_text = retrieval.get("source_text", "")

    # -------------------------------------------------
    # INTEGRITY: summary must be prose, not raw JSON
    # -------------------------------------------------
    # When the LLM truncates JSON or fails the contract, the agent's
    # fallback dumps raw model output into `summary`. Catch that here.
    if _looks_like_json_blob(summary_text):
        errors.append("Summary field contains raw JSON, not prose (LLM fallback path)")

    # -------------------------------------------------
    # INTEGRITY: non-trivial lessons must yield key_concepts
    # -------------------------------------------------
    if len(source_text) >= NONTRIVIAL_SOURCE_CHARS and not key_concepts:
        errors.append("Non-trivial lesson produced no key_concepts")

    # -------------------------------------------------
    # GROUNDING (weak heuristic)
    # -------------------------------------------------
    src_lower = source_text.lower()
    sum_lower = summary_text.lower()

    if sum_lower and src_lower:
        overlap_found = any(
            word in src_lower for word in sum_lower.split()[:10]
        )
        if not overlap_found:
            warnings.append("Weak grounding signal detected")

    # -------------------------------------------------
    # FINAL RESULT
    # -------------------------------------------------
    if errors:
        return _fail(errors, warnings)

    return {
        "validation": "PASS",
        "score": 1 if not warnings else 0.7,
        "errors": [],
        "warnings": warnings,
        "validated_at": datetime.utcnow().isoformat(),
    }


def _looks_like_json_blob(text: str) -> bool:
    """
    Detect summaries that are actually raw JSON (the fallback path).
    A real prose summary should not start with { or [, and should not
    contain the structural keys verbatim.
    """
    if not text:
        return False
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        return True
    if '"key_concepts"' in text or '"definitions"' in text:
        return True
    return False


def _fail(errors, warnings):
    return {
        "validation": "FAIL",
        "score": 0,
        "errors": errors,
        "warnings": warnings,
        "validated_at": datetime.utcnow().isoformat(),
    }
