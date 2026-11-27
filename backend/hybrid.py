"""
backend/hybrid.py
Unified Hybrid Query Pipeline for Local College Intelligence (C-GPT).

Routing modes:
  SQL_ONLY  — structured data questions (attendance %, marks, student records, fees)
  RAG_ONLY  — policy/regulation/handbook questions answered from ChromaDB docs
  HYBRID    — queries that require BOTH: e.g. "who is below the minimum threshold?"
              Runs SQL and RAG in parallel, then fuses results into one grounded answer.

RBAC:
  - ChromaDB: role filter enforced INSIDE the vector query (pre-retrieval).
  - SQL: student role gets WHERE clause injection to restrict to their own USN if
         student context is resolvable; all roles are SELECT-only (safety gate).
  - LLM never executes SQL — Python does.

Concurrency:
  LLM calls are serialized via _llm_semaphore in backend/llm_service.py so
  concurrent requests do not contend for GPU VRAM.
"""

import re
import time
import sqlite3
from concurrent.futures import ThreadPoolExecutor
import pandas as pd

import backend.llm_service as llm_service
from backend.config import DB_PATH, CHROMA_DIR, CHROMA_COLLECTION, EMBED_MODEL
from backend.rag import _get_embedder, _get_collection, VALID_ROLES

# ── Route labels ──────────────────────────────────────────────────────────────
SQL_ONLY = "SQL_ONLY"
RAG_ONLY = "RAG_ONLY"
HYBRID   = "HYBRID"

# SQL safety gate
_FORBIDDEN_SQL = ["drop", "delete", "update", "insert", "alter", "truncate", "create", "attach"]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_db():
    return sqlite3.connect(DB_PATH)


def _get_schema() -> tuple[list[str], str]:
    """Return (table_names, schema_text) with one block per table."""
    conn = _get_db()
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cur.fetchall()]
    blocks = []
    for t in tables:
        cur2 = conn.execute(f"PRAGMA table_info({t});")
        cols = cur2.fetchall()
        col_defs = ", ".join(f"{c[1]} {c[2]}" for c in cols)
        lines = [f"[{t}] Columns: {col_defs}"]
        try:
            cur3 = conn.execute(f'SELECT * FROM "{t}" LIMIT 1;')
            row = cur3.fetchone()
            if row:
                col_names = [c[1] for c in cols]
                sample = ", ".join(f"{col_names[j]}={repr(v)}" for j, v in enumerate(row))
                lines.append(f"    e.g. {sample}")
        except Exception:
            pass
        blocks.append("\n".join(lines))
    conn.close()
    return tables, "\n\n".join(blocks)


def _is_safe_sql(sql: str) -> bool:
    return not any(word in sql.lower() for word in _FORBIDDEN_SQL)


def _extract_sql(raw: str) -> str:
    match = re.search(r"```(?:sql)?\s*(SELECT.*?)```", raw, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip().rstrip(";")
    match = re.search(r"(SELECT\b.*)", raw, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip().rstrip(";")
    return raw.strip()


# ─── Step 1: Query Router ────────────────────────────────────────────────────

_DATA_SIGNALS = (
    "average", "avg", "mean", "count", "how many", "which students", "list students",
    "list all students", "top ", "lowest", "highest", "scored", "score", "cie marks",
    "total cie", "el score", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8",
    "attendance %", "classes attended", "usn", "1rv", "branch", "section",
)
_DOC_SIGNALS = (
    "policy", "policies", "regulation", "regulations", "handbook", "circular",
    "syllabus", "syllabi", "document", "threshold", "target", "attainment",
    "eligibility", "eligible", "condonation", "scheme", "rule", "rules", "criteria",
    "stand for", "represent", "meaning", "definition", "consequence", "penalty",
)


def route_query(
    question: str,
    tables: list[str],
    model: str | None = None,
    history: list[dict] | None = None,
) -> str:
    """
    Use the LLM to classify the query as SQL_ONLY, RAG_ONLY, or HYBRID.
    Returns one of the three constants.
    Includes a deterministic safeguard so queries combining data/aggregation
    signals with policy/document signals are never downgraded to RAG_ONLY.
    Falls back to RAG_ONLY on any failure.
    """
    sql_hint = ", ".join(tables) if tables else "none"
    history_block = llm_service.format_history(history, max_turns=4)
    prompt = (
        "/no_think Classify the user question for an institutional AI system.\n\n"
        f"Available SQL tables: {sql_hint} (contain student records, attendance %, CIE marks Q1-Q8, EL scores, CO/PO tags, CGPA).\n"
        "Available document types: regulations, handbooks, circulars, syllabi, CO-PO attainment targets, attendance policies, fee policies.\n\n"
        "Return ONLY valid JSON with one key 'route' whose value is exactly one of: "
        '"SQL_ONLY", "RAG_ONLY", "HYBRID".\n\n'
        "Rules:\n"
        '- SQL_ONLY: question asks ONLY for numbers/records/averages from tables (e.g. "average CIE marks per branch", "top 5 students by CGPA").\n'
        '- RAG_ONLY: question asks ONLY about policies, rules, procedures, regulations, handbooks, syllabi, or definitions (no student numbers).\n'
        '- HYBRID: question needs BOTH database numbers/averages/student scores AND policy/document/target context '
        '(e.g. "who is below the minimum attendance threshold?", "what is the average CIE score on CO1/PO1 compared to the CO1 attainment target?").\n'
        'If a question asks for averages, scores, or student lists AND compares them to a policy, threshold, target, or document, choose "HYBRID".\n\n'
        f"{history_block}"
        f"Question: {question}\n\n"
        'JSON response (only the JSON, nothing else):'
    )

    route = RAG_ONLY
    try:
        result = llm_service.generate(
            prompt=prompt,
            model=model,
            temperature=0.0,
            num_predict=30,
            num_ctx=1024,
        )
        raw = result.get("response", "").strip()
        m = re.search(r'\{.*?"route"\s*:\s*"(SQL_ONLY|RAG_ONLY|HYBRID)".*?\}', raw, re.DOTALL)
        if m:
            route = m.group(1)
        else:
            for label in (HYBRID, SQL_ONLY, RAG_ONLY):
                if label in raw.upper():
                    route = label
                    break
    except Exception:
        route = RAG_ONLY

    # Deterministic safeguard: if both data signals and doc signals are present and tables exist,
    # ensure we run HYBRID rather than dropping SQL or RAG.
    if tables and route != HYBRID:
        q_lower = question.lower()
        has_data = any(sig in q_lower for sig in _DATA_SIGNALS)
        has_doc = any(sig in q_lower for sig in _DOC_SIGNALS)
        if has_data and has_doc:
            return HYBRID

    return route


# ─── Step 2a: SQL sub-task ───────────────────────────────────────────────────

def run_sql(
    question: str,
    role: str,
    tables: list[str],
    schema: str,
    model: str | None = None,
    history: list[dict] | None = None,
) -> dict:
    """
    Generate and execute a SELECT query.
    Returns { sql, result, columns, row_count, error }.
    RBAC: all roles are SELECT-only. Student role gets an extra safety note in
    the prompt (USN-level restriction requires a user→USN mapping, not yet in auth).
    """
    if not tables:
        return {"sql": None, "result": [], "columns": [], "row_count": 0,
                "error": "No structured data tables available."}

    role_note = ""
    if role == "student":
        role_note = (
            "IMPORTANT: This query is for a student — only return aggregate or summary data, "
            "never return a full list of all students' private records.\n"
        )

    history_block = llm_service.format_history(history, max_turns=4)
    prompt = (
        f"/no_think SQLite expert. Output ONLY a SELECT SQL query — no explanation, no markdown.\n\n"
        f"Tables:\n{schema}\n\n"
        f"{role_note}"
        "Rules:\n"
        "- Use ONLY column names from the schema above; pick the single best table whose columns match the question.\n"
        "- Prefer filtering directly on that table's own columns (e.g. WHERE branch = 'CSE') instead of subqueries to other tables.\n"
        "- Numeric columns compare as numbers.\n"
        "- CRITICAL for percentage math & SQLite integer division: SQLite does integer division on integers (12 / 15 = 0!). "
        "ALWAYS multiply by 100.0 FIRST and use .0 on divisors, dividing *_max_N_ sums by the SUM of their max values "
        "(e.g. AVG((q1_score__max_5_ + q5_score__max_10_) * 100.0 / 15.0)), NEVER write / 15 * 100 or / 100.\n"
        "- If the question is a follow-up (e.g. 'give their attendance and admission type also', 'their names'), "
        "reuse the SAME table and WHERE filter from the previous turn's [SQL: ...] and add the requested columns — "
        "do NOT switch tables or add unnecessary JOINs unless the user asks for a different course/table.\n"
        "- When asked 'in more than one course', 'more than N times', or 'at least N', aggregate/filter in SQL using GROUP BY student_name, usn HAVING COUNT(*) > 1 (or COUNT(DISTINCT course_name) > 1) so SQL returns ONLY the qualifying students and their counts/courses.\n"
        "- Never write a JOIN without a valid ON condition.\n"
        "- No markdown, no comments; end with semicolon.\n\n"
        f"{history_block}"
        f"Question: {question}\n"
        "SQL:"
    )

    try:
        result = llm_service.generate(
            prompt=prompt,
            model=model,
            temperature=0.0,
            num_predict=180,
            num_ctx=4096,
        )
    except RuntimeError as e:
        return {"sql": None, "result": [], "columns": [], "row_count": 0, "error": str(e)}

    raw_sql = result.get("response", "").strip()
    sql = _extract_sql(raw_sql)

    if not _is_safe_sql(sql):
        return {"sql": sql, "result": [], "columns": [], "row_count": 0,
                "error": "Generated SQL contains forbidden operations. Rejected."}
    if not sql.upper().startswith("SELECT"):
        return {"sql": sql, "result": [], "columns": [], "row_count": 0,
                "error": "LLM did not produce a SELECT statement."}

    conn = _get_db()
    try:
        df = pd.read_sql_query(sql, conn)
    except Exception as e:
        conn.close()
        return {"sql": sql, "result": [], "columns": [], "row_count": 0,
                "error": f"SQL execution failed: {e}"}
    conn.close()

    clean_df = df.astype(object).where(pd.notnull(df), None)
    return {
        "sql": sql,
        "result": clean_df.to_dict(orient="records"),
        "columns": list(df.columns),
        "row_count": len(df),
        "error": None,
    }


# ─── Step 2b: RAG sub-task ───────────────────────────────────────────────────

def run_rag(question: str, role: str, k: int = 6) -> dict:
    """
    Retrieve top-k role-filtered chunks from ChromaDB.
    Fetches a wider candidate pool (max(k*2, 12)) and applies keyword-overlap
    re-ranking + per-source diversity (max 2 chunks per document) so one large
    handbook does not crowd out specific policy/CO-PO documents.
    Does NOT call the LLM — that happens in the synthesis step.
    """
    embedder = _get_embedder()
    q_vec = embedder.encode([question], normalize_embeddings=True).tolist()
    fetch_k = max(k * 2, 12)

    try:
        col = _get_collection()
        results = col.query(
            query_embeddings=q_vec,
            n_results=fetch_k,
            where={f"role_{role}": True},
        )
    except Exception as e:
        return {"chunks": [], "sources": [], "error": str(e)}

    docs   = results["documents"][0]
    metas  = results["metadatas"][0]
    dists  = results["distances"][0]

    # Re-rank candidates: vector distance minus a small bonus for keyword hits in source/section/text
    q_tokens = {w for w in re.findall(r"[a-z0-9]{2,}", question.lower()) if w not in {
        "what", "is", "the", "of", "by", "on", "and", "to", "in", "for", "are", "how",
        "with", "from", "that", "this", "which", "students", "student", "compared",
    }}

    scored = []
    for doc, m, d in zip(docs, metas, dists):
        hay = f"{m.get('source', '')} {m.get('section', '')} {doc[:300]}".lower()
        hits = sum(1 for tok in q_tokens if tok in hay)
        adj_score = d - min(hits * 0.03, 0.25)
        scored.append((adj_score, doc, m, d))

    scored.sort(key=lambda x: x[0])

    # Keep at most 2 chunks per source file so diverse documents surface
    picked = []
    per_source: dict[str, int] = {}
    for _, doc, m, d in scored:
        src = m["source"]
        if per_source.get(src, 0) >= 2:
            continue
        per_source[src] = per_source.get(src, 0) + 1
        picked.append((doc, m, d))
        if len(picked) >= k:
            break

    chunks = [(doc, m["source"], m["section"], round(d, 4))
              for doc, m, d in picked]
    sources = [{"source": m["source"], "section": m["section"], "distance": round(d, 4)}
               for _, m, d in picked]

    return {"chunks": chunks, "sources": sources, "error": None}


# ─── Step 3: Synthesis ────────────────────────────────────────────────────────

def synthesize(
    question: str,
    role: str,
    route: str,
    sql_data: dict | None,
    rag_data: dict | None,
    model: str | None = None,
    history: list[dict] | None = None,
) -> str:
    """
    Build a grounded synthesis prompt fusing SQL rows + RAG chunks and call the LLM.
    """
    sections = []

    if sql_data and sql_data.get("result") and not sql_data.get("error"):
        rows = sql_data["result"]
        cols = sql_data["columns"]
        # Render up to 120 rows (bounded by ~6000 chars) so late-alphabet students (e.g. V-Z) are not cut off
        header = " | ".join(cols)
        divider = "-" * len(header)
        rendered_rows = []
        total_chars = 0
        for row in rows[:120]:
            line = " | ".join(str(row.get(c, "")) for c in cols)
            if total_chars + len(line) > 6000:
                break
            rendered_rows.append(line)
            total_chars += len(line) + 1
        rows_str = "\n".join(rendered_rows)
        omitted = len(rows) - len(rendered_rows)
        suffix = f"\n... ({omitted} more rows)" if omitted > 0 else ""
        sections.append(
            f"[STRUCTURED DATA — SQL result ({len(rows)} rows)]\n"
            f"Query: {sql_data['sql']}\n\n"
            f"{header}\n{divider}\n{rows_str}{suffix}"
        )
    elif sql_data and sql_data.get("error"):
        sections.append(f"[STRUCTURED DATA — unavailable: {sql_data['error']}]")
    elif sql_data and sql_data.get("sql"):
        sections.append(
            f"[STRUCTURED DATA — SQL query returned 0 matching rows]\n"
            f"Query: {sql_data['sql']}"
        )

    if rag_data and rag_data.get("chunks"):
        doc_parts = []
        for text, source, section, dist in rag_data["chunks"]:
            doc_parts.append(f"[{source} › {section}]\n{text}")
        sections.append("[DOCUMENT CONTEXT]\n" + "\n\n---\n\n".join(doc_parts))
    elif rag_data and rag_data.get("error"):
        sections.append(f"[DOCUMENT CONTEXT — unavailable: {rag_data['error']}]")

    combined_context = "\n\n" + "\n\n".join(sections) if sections else ""

    route_instruction = {
        SQL_ONLY: "Use the structured SQL result to answer precisely.",
        RAG_ONLY: "Use the document context to answer. Cite sources as [filename › section].",
        HYBRID:   (
            "Fuse the SQL result rows and document context to answer. "
            "Quote the exact policy threshold from the documents and cross-reference it "
            "with the actual student numbers. Cite document sources as [filename › section]."
        ),
    }.get(route, "Answer from the provided context.")

    history_block = llm_service.format_history(history, max_turns=6)
    prompt = (
        "/no_think You are an institutional AI assistant for RVCE, Bengaluru.\n"
        "Answer ONLY from the context and previous turns in this chat provided below. Do not use any external knowledge.\n\n"
        "Rules:\n"
        "- Cite document sources as [filename › section] when you use them.\n"
        "- If one source (SQL or Documents) returned 0 rows or is unavailable, STILL answer using the other source that IS available and explicitly mention the 0-row / unavailable part.\n"
        "- Only say 'I could not find this in the available data.' if NEITHER source contains relevant information.\n"
        "- Never invent numbers, dates, or rules.\n"
        "- When listing students from the SQL result, include EVERY qualifying student from the SQL table without skipping anyone.\n"
        f"- {route_instruction}\n"
        "- Be concise: 3–8 sentences or a short list.\n"
        f"{combined_context}\n\n"
        f"{history_block}"
        f"Question ({role}): {question}\n\n"
        "Answer:"
    )

    try:
        result = llm_service.generate(
            prompt=prompt,
            model=model,
            temperature=0.1,
            num_predict=350,
            num_ctx=4096,
        )
    except RuntimeError as e:
        return f"[LLM error: {e}]"

    return result.get("response", "").strip() or "I could not find this in the available data."


# ─── External AI Handoff Classifier ──────────────────────────────────────────

# Source files that contain academic/syllabus content safe to pass to external AI
_ELIGIBLE_SOURCES = {
    "03_cse_syllabus_co_po.md", "01_regulations_2022_scheme.md",
    "02_regulations_2024_scheme.md", "25_syllabus_cse.md", "26_syllabus_aiml.md",
    "24_scheme_cse.md", "05_student_clubs.md", "07_events_calendar.md",
    "08_library_resources.md", "09_placement_cell.md",
    # Match partial names with prefix checks (done below)
}
_INELIGIBLE_SOURCES = {
    "15_fee_", "22_nri_pg_fees.md", "10_hostel_", "12_academic_calendar_",
    "16_exam_", "23_disciplinary",
}
# Personal-data signals → never eligible
_PERSONAL_SIGNALS = (
    "my attendance", "my marks", "my cie", "my usn", "my cgpa",
    "my fee", "my room", "my seat", "my timetable",
)
# Broad/full-syllabus signals
_BROAD_SIGNALS = (
    "entire syllabus", "all units", "full course", "complete syllabus",
    "all topics", "whole syllabus", "all modules",
)
# Conceptual/academic question signals
_CONCEPT_SIGNALS = (
    "explain", "what is", "how does", "how do", "describe", "compare",
    "difference between", "define", "example", "examples", "study",
    "learn", "understand", "concept", "algorithm", "theory", "types of",
    "advantages", "disadvantages", "applications", "use case",
)


def _source_eligible(sources: list[dict]) -> bool:
    """Return True if any retrieved source belongs to an academic/syllabus doc."""
    if not sources:
        return False
    for s in sources:
        src = s.get("source", "")
        # Check exact match
        if src in _ELIGIBLE_SOURCES:
            return True
        # Partial prefix check for regulations/syllabus patterns
        if any(src.startswith(p) for p in (
            "01_regulations", "02_regulations", "25_syllabus", "26_syllabus",
            "24_scheme", "03_cse_syllabus", "04_", "06_",
        )):
            # But exclude personal/admin docs
            if not any(src.startswith(bad) for bad in _INELIGIBLE_SOURCES):
                return True
    return False


def _classify_handoff(
    question: str,
    route: str,
    sql_data: dict | None,
    rag_data: dict | None,
    role: str,
    answer: str,
) -> dict:
    """
    Classify whether the response is eligible for external AI handoff.

    Returns:
        {
          "eligible": bool,
          "context":  str,   # role-aware, privacy-safe prompt payload
          "topic":    str,   # short topic label
          "is_broad": bool,  # True when full-syllabus payload is included
        }
    """
    q = question.lower()

    # Hard block: personal data questions
    if any(sig in q for sig in _PERSONAL_SIGNALS):
        return {"eligible": False, "context": "", "topic": "", "is_broad": False}

    # Hard block: pure SQL with individual student rows (non-aggregate)
    if route == SQL_ONLY:
        # Eligible only if it's an aggregate query (no USN/individual columns)
        sql = (sql_data or {}).get("sql", "") or ""
        result = (sql_data or {}).get("result", []) or []
        cols = {c.lower() for c in (sql_data or {}).get("columns", [])}
        has_individual = bool(cols & {"usn", "student_name", "name"}) and len(result) > 1
        if has_individual:
            return {"eligible": False, "context": "", "topic": "", "is_broad": False}
        # Aggregate SQL — eligible (e.g. counts, averages)
        context = f"Question: {question}\n\nAnswer:\n{answer[:600]}"
        return {"eligible": True, "context": context, "topic": "data query", "is_broad": False}

    # RAG_ONLY or HYBRID: check doc sources
    sources = (rag_data or {}).get("sources", []) or []
    if not _source_eligible(sources):
        return {"eligible": False, "context": "", "topic": "", "is_broad": False}

    # At least one conceptual signal required
    is_conceptual = any(sig in q for sig in _CONCEPT_SIGNALS) or route in (RAG_ONLY,)
    if not is_conceptual:
        # Still check whether the route was doc-only (always conceptual by definition)
        if route == SQL_ONLY:
            return {"eligible": False, "context": "", "topic": "", "is_broad": False}

    # Determine if broad or specific
    is_broad = any(sig in q for sig in _BROAD_SIGNALS)

    # Build context payload (privacy-safe: answer text + doc metadata only, no SQL rows)
    source_refs = "; ".join(
        f"{s['source']} › {s.get('section', '')}" for s in sources[:4]
    )
    if is_broad:
        # Include doc chunk summaries (from rag_data chunks) up to 2500 chars
        chunks = (rag_data or {}).get("chunks", []) or []
        chunk_texts = []
        total = 0
        for chunk in chunks:
            text = chunk[0] if isinstance(chunk, (list, tuple)) else chunk.get("text", "")
            if total + len(text) > 2500:
                break
            chunk_texts.append(text)
            total += len(text)
        context = (
            f"Question: {question}\n\n"
            f"Sources: {source_refs}\n\n"
            f"Syllabus/Regulation Content:\n" + "\n---\n".join(chunk_texts)
        )
    else:
        # Specific concept: answer + source refs
        context = (
            f"Question: {question}\n\n"
            f"Answer Summary: {answer[:700]}\n\n"
            f"Sources: {source_refs}"
        )

    # Topic label: first meaningful noun phrase from question
    topic_words = [w for w in question.split() if len(w) > 3 and w[0].isupper()]
    topic = " ".join(topic_words[:3]) if topic_words else question[:40]

    return {
        "eligible": True,
        "context": context[:3000],
        "topic": topic,
        "is_broad": is_broad,
    }


# ─── Main entry point ─────────────────────────────────────────────────────────

def ask(
    question: str,
    role: str,
    model: str | None = None,
    history: list[dict] | None = None,
) -> dict:
    """
    Unified hybrid query entry point.

    Args:
        question: User's natural-language question.
        role:     One of 'student', 'faculty', 'hod', 'admin'.
        model:    Generation model (None = active model from llm_service).
        history:  Recent turns from the current chat session only.


    Returns:
        {
            answer:       str,
            route:        'SQL_ONLY' | 'RAG_ONLY' | 'HYBRID',
            sql_query:    str | None,
            sql_result:   list[dict] | None,
            sql_columns:  list[str] | None,
            sql_row_count: int | None,
            doc_sources:  list[{source, section, distance}],
            time_taken_ms: int,
        }
    """
    t0 = time.time()
    role = role.strip().lower()
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of {VALID_ROLES}.")

    tables, schema = _get_schema()

    # ── 1. Route classification ───────────────────────────────────────────────
    route = route_query(question, tables, model, history=history)
    rag_query = llm_service.contextualize_search_query(question, history)

    # ── 2. Run sub-tasks (SQL and/or RAG; parallel when HYBRID) ──────────────
    sql_data: dict | None = None
    rag_data: dict | None = None

    if route == HYBRID:
        with ThreadPoolExecutor(max_workers=2) as pool:
            sql_future = pool.submit(run_sql, question, role, tables, schema, model, history)
            rag_future = pool.submit(run_rag, rag_query, role)
            sql_data = sql_future.result()
            rag_data = rag_future.result()
    elif route == SQL_ONLY:
        sql_data = run_sql(question, role, tables, schema, model, history)
    elif route == RAG_ONLY:
        rag_data = run_rag(rag_query, role)

    # ── 3. Synthesize final answer ────────────────────────────────────────────
    answer = synthesize(question, role, route, sql_data, rag_data, model, history=history)

    time_taken_ms = round((time.time() - t0) * 1000)

    handoff = _classify_handoff(question, route, sql_data, rag_data, role, answer)

    return {
        "answer":           answer,
        "route":            route,
        "sql_query":        sql_data.get("sql") if sql_data else None,
        "sql_result":       sql_data.get("result") if sql_data else None,
        "sql_columns":      sql_data.get("columns") if sql_data else None,
        "sql_row_count":    sql_data.get("row_count") if sql_data else None,
        "sql_error":        sql_data.get("error") if sql_data else None,
        "doc_sources":      rag_data.get("sources", []) if rag_data else [],
        "time_taken_ms":    time_taken_ms,
        "external_handoff": handoff,
    }
