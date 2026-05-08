"""
Model Router

Central source of truth for which Ollama model each agent role uses.
Change model assignments here in one place; agents import the role they need.

Design:
- Per-role specialization: each agent gets the model best suited to its job.
- LLM-as-judge separation: GRADE uses a different model than the generators
  (SUMMARIZE, QUIZ_GENERATE) to reduce self-bias when scoring output.

Note: Ollama may evict an idle model from memory when serving another, so
the first call after switching roles can be slow.
"""

# -------- Generator roles --------
SUMMARIZE = "llama3:8b"            # structured extraction of lesson content
QUIZ_GENERATE = "llama3.2:latest"  # recall-question phrasing from SOT entries
# llama3.2 has a 128K context window, which the advisor needs for
# course-wide queries ("study guide for BE101") that select 20+ SOT
# entries — llama3:8b's 8K cap was squeezing the output too hard.
ADVISE = "llama3.2:latest"

# -------- Judge role --------
GRADE = "mistral:latest"           # scores user answers; separate from generators
