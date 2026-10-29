"""
backend/evaluate.py
Batch evaluation of the RAG pipeline against test_questions.json.

Run from the repo root (venv active):
    python backend/evaluate.py

Output:
    - Per-question results printed to stdout
    - Full results saved to logs/rag_eval_results.json
    - Summary: retrieval hit rate, permission leak count, manual-review list
"""

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEST_FILE = os.path.join(ROOT, "unstructured_data", "synthetic", "test_questions.json")
LOG_DIR = os.path.join(ROOT, "logs")
LOG_FILE = os.path.join(LOG_DIR, "rag_eval_results.json")

# Add repo root to path so `from backend.rag import ...` works when run directly
sys.path.insert(0, ROOT)
from backend.rag import answer_question  # noqa: E402  (after sys.path insert)


def run_evaluation():
    os.makedirs(LOG_DIR, exist_ok=True)

    # ── Load test questions ───────────────────────────────────────────────────
    if not os.path.exists(TEST_FILE):
        sys.exit(f"ERROR: Test file not found: {TEST_FILE}\n"
                 "Run `python backend/ingest.py` first to build the index.")

    with open(TEST_FILE, encoding="utf-8") as f:
        questions = json.load(f)

    print(f"\n{'='*70}")
    print(f"  RAG Evaluation — {len(questions)} questions")
    print(f"{'='*70}\n")

    results = []
    retrieval_hits = 0
    retrieval_total = 0  # excludes unanswerable/permission types
    permission_leaks = 0
    manual_review = []

    for q in questions:
        qid      = q.get("id", "?")
        qtype    = q.get("type", "factual")
        role     = q.get("role", "student")
        question = q["question"]
        expected = q.get("expected_answer", "")
        exp_src  = q.get("source", "")
        must_not = q.get("must_not_contain", [])  # list of strings (for permission tests)

        print(f"[{qid}] ({qtype}, role={role})")
        print(f"  Q: {question}")

        # ── Call RAG ─────────────────────────────────────────────────────────
        try:
            out = answer_question(question=question, role=role)
            answer  = out["answer"]
            sources = out["sources"]
        except Exception as e:
            answer  = f"ERROR: {e}"
            sources = []

        print(f"  A: {answer[:200]}{'...' if len(answer) > 200 else ''}")
        print(f"  Expected: {expected[:120]}{'...' if len(expected) > 120 else ''}")

        retrieved_sources = [s["source"] for s in sources]
        retrieved_text    = " ".join(s["section"] for s in sources) + " " + answer

        # ── Retrieval hit check (skip for unanswerable / permission types) ────
        hit = None
        if qtype not in ("unanswerable", "permission") and exp_src:
            hit = exp_src in retrieved_sources
            retrieval_total += 1
            if hit:
                retrieval_hits += 1
            print(f"  Retrieval hit: {'✓ YES' if hit else '✗ NO'} (expected src: {exp_src})")
            print(f"  Retrieved:     {retrieved_sources}")

        # ── Permission leak check ─────────────────────────────────────────────
        leak = None
        if qtype == "permission" and must_not:
            leaked = [s for s in must_not if s.lower() in retrieved_text.lower()]
            leak = bool(leaked)
            if leak:
                permission_leaks += 1
                print(f"  ⚠ PERMISSION LEAK: found {leaked} in answer/sources!")
            else:
                print(f"  ✓ Permission OK — none of {must_not} found in response")

        # ── Flag for manual review ────────────────────────────────────────────
        manual_review.append({
            "id": qid,
            "question": question,
            "answer": answer,
            "expected": expected,
        })

        print()

        results.append({
            "id": qid,
            "type": qtype,
            "role": role,
            "question": question,
            "answer": answer,
            "expected_answer": expected,
            "expected_source": exp_src,
            "retrieved_sources": retrieved_sources,
            "retrieval_hit": hit,
            "permission_leak": leak,
            "sources": sources,
        })

    # ── Save full results ─────────────────────────────────────────────────────
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # ── Print summary ─────────────────────────────────────────────────────────
    hit_rate = (retrieval_hits / retrieval_total * 100) if retrieval_total else 0.0

    print(f"\n{'='*70}")
    print("  SUMMARY")
    print(f"{'='*70}")
    print(f"  Total questions        : {len(questions)}")
    print(f"  Retrieval hit rate     : {retrieval_hits}/{retrieval_total} "
          f"({hit_rate:.1f}%)  [excludes unanswerable/permission]")
    print(f"  Permission leaks       : {permission_leaks}  (must be 0)")
    print(f"  Full results saved to  : {LOG_FILE}")
    print(f"\n  ── Questions for manual answer review ──")
    for item in manual_review:
        print(f"  [{item['id']}] {item['question']}")
    print(f"{'='*70}\n")

    if permission_leaks > 0:
        print(f"⚠ WARNING: {permission_leaks} permission leak(s) detected! "
              "Check access metadata in ingest.py.\n")
    else:
        print("✓ No permission leaks detected.\n")


if __name__ == "__main__":
    run_evaluation()
