"""
Quiz endpoints — first downstream consumer of the SOT.

POST /api/quiz/question  body: {event_id}                  → {question, generated_at}
POST /api/quiz/random    body: {}                           → {event_id, course, week,
                                                              lesson, question, ...}
                          Picks a random canonical lesson AND generates the
                          question in one round trip. Powers the mobile
                          "Quick Quiz" snacking flow — one tap, one question.
POST /api/quiz/grade     body: {event_id, question, user_answer}
                          → {score, feedback, correct_points, missed_points, graded_at}

Stateless: the frontend holds the question between calls. Each grade
is persisted as one quiz_attempt record in the gradebook (Phase 3)
for later aggregation into per-lesson extra credit.
"""

import json
import os
import random
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.quiz_agent import generate_question, grade_answer
from core.gradebook_store import record_quiz_attempt
from core.sot_groups import canonical_entries


router = APIRouter()

SOT_FILE = "memory_store.json"


def _load_sot():
    if not os.path.exists(SOT_FILE):
        return []
    with open(SOT_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def _find_entry(event_id: str):
    for entry in _load_sot():
        if entry.get("event_id") == event_id:
            return entry
    return None


class QuestionRequest(BaseModel):
    event_id: str


class GradeRequest(BaseModel):
    event_id: str
    question: str
    user_answer: str


@router.post("/quiz/question")
def quiz_question(req: QuestionRequest):
    entry = _find_entry(req.event_id)
    if not entry:
        raise HTTPException(status_code=404, detail="SOT entry not found")
    return generate_question(entry)


# How many random picks we'll try before giving up. Each attempt is one
# LLM call (~10s), so we cap low — if we strike out 3 times in a row
# something is wrong with the SOT contents and the user should know.
_RANDOM_QUIZ_MAX_ATTEMPTS = 3


@router.post("/quiz/random")
def quiz_random():
    """
    Pick a random canonical SOT entry and generate one question for it.

    Powers the mobile "Quick Quiz" flow — one tap from the home screen
    skips the picker entirely. The combined endpoint (random pick +
    question generation in one round trip) keeps the snacking-format
    UX feeling instant: tap chip, see loading, see question. No "first
    pick a lesson" friction.

    Retries up to _RANDOM_QUIZ_MAX_ATTEMPTS times if a chosen lesson
    fails question generation (typically: empty summary, or the LLM
    returned malformed JSON). Each retry picks a DIFFERENT lesson so
    we don't loop on the same bad entry.
    """
    sot = _load_sot()
    canonical = canonical_entries(sot)
    # Substantive-content filter: a lesson with no summary can't be
    # quizzed on (the generate_question prompt requires a summary).
    # Filtering here saves an LLM call per skip.
    eligible = [e for e in canonical if (e.get("summary") or "").strip()]
    if not eligible:
        raise HTTPException(
            status_code=404,
            detail="No quizzable lessons in the SOT yet — ingest one first.",
        )

    # Sample without replacement across attempts so a bad lesson doesn't
    # get re-picked. random.sample handles both the "fewer eligible
    # lessons than max_attempts" case and the normal case in one line.
    candidates = random.sample(
        eligible,
        min(_RANDOM_QUIZ_MAX_ATTEMPTS, len(eligible)),
    )

    last_error = None
    for entry in candidates:
        result = generate_question(entry)
        question = result.get("question")
        if question and isinstance(question, str) and question.strip():
            # Return identity + question in one shape so the frontend
            # can drop straight into answering state.
            return {
                "event_id": entry.get("event_id"),
                "course": entry.get("course"),
                "week": entry.get("week"),
                "lesson": entry.get("lesson"),
                "question": question,
                "model": result.get("model"),
                "generated_at": result.get("generated_at"),
            }
        last_error = result.get("error") or "Question generation returned empty"

    raise HTTPException(
        status_code=502,
        detail=f"Couldn't generate a Quick Quiz question after {len(candidates)} attempts: {last_error}",
    )


@router.post("/quiz/grade")
def quiz_grade(req: GradeRequest):
    entry = _find_entry(req.event_id)
    if not entry:
        raise HTTPException(status_code=404, detail="SOT entry not found")
    result = grade_answer(req.question, req.user_answer, entry)

    # Phase 3 gradebook — persist every graded quiz attempt. Wrapped
    # in try/except so gradebook failures never break the quiz
    # response. Best-attempt aggregation happens at read time in
    # core.grading; this is just collection.
    try:
        record_quiz_attempt(
            lesson_event_id=req.event_id,
            course=entry.get("course") or "",
            week=entry.get("week") or "",
            lesson=entry.get("lesson") or "",
            question=req.question,
            score=int(result.get("score", 0)),
            model=result.get("model") or "",
        )
    except Exception as e:
        print(f"[quiz] gradebook write failed (non-fatal): {e}", file=sys.stderr, flush=True)

    return result
