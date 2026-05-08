"""
Ingestion Pipeline (streaming)

Yields discrete progress events so the UI can light each pipeline node
in real time as the backend actually finishes that step — instead of a
client-side timer faking progress after the response returns.

Event shapes:
    {"type": "start",         "event": {...}}
    {"type": "step_start",    "step": "<name>"}
    {"type": "step_complete", "step": "<name>", ...step-specific fields}
    {"type": "done"}
    {"type": "error",         "message": "..."}

Pipeline contract (unchanged):
    ingest_received → retrieval → summarization → validation → memory_write
Memory write is gated on validation == PASS.
"""

import sys

from agents.summarization_agent import summarize_lesson
from agents.validation_agent import validate_summary
from core.memory_writer_node import write_to_memory
from core.retrieval_node import build_retrieval_context


def stream_ingestion_pipeline(event):
    yield {"type": "start", "event": event.model_dump()}

    # ---------------- ingest ----------------
    yield {"type": "step_start", "step": "ingest_received"}
    yield {
        "type": "step_complete",
        "step": "ingest_received",
        "event_id": event.event_id,
    }

    # ---------------- retrieval ----------------
    yield {"type": "step_start", "step": "retrieval"}
    retrieval = build_retrieval_context(event)
    yield {
        "type": "step_complete",
        "step": "retrieval",
        "status": "complete",
        "data": retrieval,
    }

    # ---------------- summarization ----------------
    yield {"type": "step_start", "step": "summarization"}
    raw_text = retrieval.get("source_text", "")
    summarization = summarize_lesson(raw_text)
    yield {
        "type": "step_complete",
        "step": "summarization",
        "status": "complete",
        "data": summarization,
    }

    # ---------------- validation ----------------
    yield {"type": "step_start", "step": "validation"}
    validation_context = {"retrieval": retrieval, "summarization": summarization}
    validation = validate_summary(validation_context)

    # Log validation FAILs to stderr so we can debug rejected ingests
    # (the streaming response carries the detail to the UI, but it's
    # gone once the user navigates away).
    if validation.get("validation") != "PASS":
        payload = event.payload
        print(
            "[validation FAIL] "
            f"course={payload.get('course')!r} "
            f"week={payload.get('week')!r} "
            f"lesson={payload.get('lesson')!r}\n"
            f"  errors:   {validation.get('errors', [])}\n"
            f"  warnings: {validation.get('warnings', [])}\n"
            f"  summary preview ({len(summarization.get('summary') or '')} chars): "
            f"{(summarization.get('summary') or '')[:200]!r}\n"
            f"  key_concepts: {summarization.get('key_concepts')}\n"
            f"  source_text length: {len(retrieval.get('source_text') or '')} chars",
            file=sys.stderr,
            flush=True,
        )

    yield {
        "type": "step_complete",
        "step": "validation",
        "status": validation.get("validation"),
        "score": validation.get("score", 0),
        "errors": validation.get("errors", []),
        "warnings": validation.get("warnings", []),
        "validated_at": validation.get("validated_at"),
    }

    # ---------------- memory write (gated) ----------------
    yield {"type": "step_start", "step": "memory_write"}
    if validation.get("validation") != "PASS":
        result = {"status": "skipped", "reason": "validation_failed"}
    else:
        result = write_to_memory(event, summarization, validation)
    yield {
        "type": "step_complete",
        "step": "memory_write",
        "status": result.get("status", "written"),
        "details": result,
    }

    yield {"type": "done"}
