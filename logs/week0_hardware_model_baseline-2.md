# Week 0 — Hardware & Model Baseline

**Project:** Offline Institutional AI
**Hardware:** 8 GB RAM, 10th-gen Intel i3, headless Ubuntu Server 24.04 LTS
**Date:** Week 0 smoke test, September 2026

---

## 1. Infrastructure Setup — Completed

- Ubuntu Server 24.04 LTS installed headless (no GUI)
- Static IP configured via netplan (interface: `w1o1`), after resolving:
  - An empty `/etc/netplan/` directory (expected — no network had been configured yet)
  - A yaml indentation error (`expected mapping`) — fixed by rewriting the file with pure spaces, no tabs
  - A `netplan-wpa-w1o1.service` failure — resolved once the Wi-Fi SSID/password in the yaml were corrected
  - A 5GHz association issue — connection succeeded after confirming the driver/AP band; 2.4GHz used as a reliable fallback where needed
- OpenSSH confirmed active (`systemctl status ssh`)
- SSH access verified from a second device (Mac) — confirmed as the "no one needs to touch the server again" checkpoint
- All team members practiced SSH, `tmux` (including named multi-session usage: `tmux new -s <name>`, `tmux ls`, `tmux attach -t <name>`), `htop`, and `free -h`

---

## 2. Inference Engine Decision: Ollama over raw llama.cpp

**Finding:** The same model, same quantization, same hardware produced very different real RAM usage depending on the inference engine.

- Raw llama.cpp run: ~6.45 GB / 7.54 GB RAM during inference (idle baseline was <350 MB, confirmed clean)
- Ollama run (after correcting context window defaults): **under 3.5 GB during inference**

**Root cause:** Ollama's default context-window (KV cache) allocation was more conservative and better suited to short RAG-style contexts than the raw llama.cpp invocation.

**Decision: Standardize on Ollama for the rest of the project.**

---

## 3. Model Size Decision: 8B ruled out, 4B confirmed viable

| Model | Result |
|---|---|
| Qwen3-4B | RAM ~3.5 GB during inference; ~4.3 GB headroom remaining for ChromaDB/FastAPI/rest of stack. Viable. |
| Qwen3-8B | Hung for 5+ minutes with no output on this hardware. Confirmed unusable. Removed (`ollama rm qwen3:8b`). |

**Decision: Qwen3-4B is the standardized model for the project.**

---

## 4. Thinking Mode Decision: disable by default (`/no_think`)

Qwen3 supports a hybrid thinking/non-thinking mode. Tested on a simple factual question ("Explain what a database index is in two sentences"):

| Mode | Tokens generated | Time | Notes |
|---|---|---|---|
| Thinking (default) | 324 tokens | 41.5 sec | ~85% of tokens were internal reasoning never shown to the user |
| `/no_think` | 50 tokens | 5.6 sec | Same answer quality, ~7x faster |

**Decision: Use `/no_think` by default for simple/direct RAG and factual queries.** Thinking mode is reserved for cases where reasoning genuinely improves correctness (see SQL findings below), evaluated case by case.

---

## 5. SQL Generation Testing

### 5.1 Bare prompt, no examples — unreliable

Given schema `attendance(student_id, date, present)` + `students(id, name)`, asked to find students below 75% attendance:

- **`/no_think`, no example (5.4 sec):** Produced syntactically valid but **functionally incorrect** SQL — filtered `WHERE present = 1` with no percentage calculation at all.
- **Thinking mode, no example (307 sec / 5+ minutes):** Produced a **correct** query (proper subquery, correct percentage logic using `COUNT(DISTINCT date)`), but took over 5 minutes and 1699 tokens, with visible repeated self-correction in the reasoning — a sign the model was near its capability ceiling for this task without guidance.
- **`/no_think`, more explicit prompt, still no example (22.6 sec):** Still **incorrect** — used the wrong column name (`s.student_id` instead of `s.id`) and computed the percentage against the total dates across the *entire table* rather than per-student.

**Conclusion: Free-form SQL generation from a bare description is not reliable at this model size, regardless of prompt clarity or thinking mode.**

### 5.2 Few-shot prompting (worked example in the prompt) — reliable

Given one correct worked example in the prompt, then asked to adapt it:

- **Same query shape, different threshold** (75% → 90%, same tables): Correct adaptation, changed only what needed changing. ~22 sec (includes model load time).
- **Different query shape entirely** (JOIN + `GROUP BY` + `AVG` + `ORDER BY` on a different schema — `students(id, name, department)` + `marks(student_id, subject, score)`, average score per department): Correct, and the model added a sensible `ROUND(..., 2)` not present in the example — a sign of genuine generalization, not just copying. **5.0 sec generation time.**

**Decision: Use few-shot prompting for SQL generation** — maintain a small library of worked SQL examples (one per common query shape: threshold/percentage, average-by-group, trend-over-time, count/filter) and include the closest matching example in the prompt for each user question. This reliably produced correct SQL at usable speed (5–10 sec) on both a similar-shape and a structurally different question.

---

## 6. RAG Faithfulness Testing

Tested with a short attendance-policy context and `/no_think` mode.

### 6.1 Answer present in context
**Q:** "What happens if a student has 60% attendance?"
**A:** "If a student has 60% attendance, they are below the 65% threshold and are not eligible for condonation. Therefore, they will be detained."
**Result:** Correct, precise, grounded — no invented detail beyond the provided context. (~8.2 sec)

### 6.2 Answer absent from context (hallucination resistance test)
**Q:** "What is the fee for condonation application?" (context never mentions a fee)
**A:** "I do not have that information."
**Result:** Correctly refused to answer rather than inventing a plausible-sounding number. (~2.0 sec)

**Decision: Qwen3-4B, with an explicit "answer only from context, say you don't know otherwise" instruction, is reliably faithful and hallucination-resistant on tested cases.**

---

## 7. Final Standardized Configuration

| Setting | Value |
|---|---|
| Inference engine | Ollama |
| Model | Qwen3-4B (Q4_K_M) |
| Default mode | `/no_think` for RAG and simple queries |
| SQL generation | Few-shot prompting with a worked-example library, `/no_think` |
| RAG prompting | Explicit "answer only from context" instruction |
| Measured RAM (model active) | ~3.5 GB |
| Measured headroom remaining | ~4.3 GB for ChromaDB, FastAPI, Python libraries, SSH/tmux sessions |
| Typical response time (simple query) | ~5–6 sec |
| Typical response time (SQL, few-shot) | ~5–11 sec |

---

## 8. Concurrent Request Testing — Completed

### 8.1 Truly simultaneous requests (fired with `&`, same instant)

Two requests backgrounded and fired at nearly the same moment, no queue managing them:

| Request | load_duration | Result |
|---|---|---|
| 1 (primary key) | ~6.33 sec | Correct answer, total 10.2 sec |
| 2 (index) | ~6.33 sec | Correct answer, total 14.0 sec |

**Finding:** Both requests paid a full model-load cost, even though the model should only need to load once. No crash, no garbled output — but a real, measurable inefficiency: simultaneous requests can trigger duplicate/competing load attempts.

### 8.2 Sequential requests (one completes, then the next fires seconds later)

| Request | load_duration | Result |
|---|---|---|
| 1 (hello) | ~0.0007 sec | Correct, 2.2 sec total |
| 2 (goodbye) | ~0.0006 sec | Correct, 3.2 sec total |

**Finding:** When requests are sequential rather than simultaneous, the model stays warm in memory — load cost drops to near-zero, and total response time is fast (2-3 sec).

### 8.3 Conclusion — directly validates the FIFO queue design

The ~6 second load penalty only appears when requests hit Ollama at the exact same instant with nothing serializing them. As long as requests are processed one at a time (even just seconds apart) — which is exactly what the Month 3 FIFO queue is designed to enforce — the model stays warm and responses stay fast (~2-3 sec for simple queries).

**This means the FIFO queue isn't just a concurrency-safety measure — it's also what keeps the model performant.** Without it, multiple near-simultaneous users would each repeatedly pay the ~6 sec reload cost; with it, only the first request after an idle period pays that cost, and every queued request after it benefits from a warm model.

---

## 9. Still To Do

- [ ] Re-confirm all team members have individually completed SSH + tmux + htop + free -h practice, not just one person.
- [ ] Test ChromaDB installed and running alongside Ollama/Qwen3-4B simultaneously — confirm real combined RAM usage rather than the estimated budget.
- [ ] Set up Python virtual environment + `requirements.txt` on the server.
- [ ] Clone team Git repo onto the server itself (repo now created).
- [ ] Stand up a minimal FastAPI "hello world" endpoint, confirmed reachable from another device over the static IP — validates the full networking path before real feature work lands on top.

---

## 10. Notes for Later Weeks

- Week 6 (local LLM integration): re-test RAM/speed numbers above under **real RAG context** (retrieved chunks included in the prompt), not just bare questions — current numbers are a clean baseline, not the final real-world figure.
- Week 14 (structured analytics): build the few-shot SQL example library referenced in Section 5.2 before this week starts, since the whole analytics deliverable depends on it.
- This document should be updated, not replaced, as more testing is done — treat it as the project's running hardware/model decision record.
