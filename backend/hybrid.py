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

def route_query(question: str, tables: list[str], model: str | None = None) -> str:
    """
    Use the LLM to classify the query as SQL_ONLY, RAG_ONLY, or HYBRID.
    Returns one of the three constants.
    Falls back to RAG_ONLY on any failure.
    """
    sql_hint = ", ".join(tables) if tables else "none"
    prompt = (
        "/no_think Classify the user question for an institutional AI system.\n\n"
        f"Available SQL tables: {sql_hint}\n"
        "Available document types: regulations, handbooks, circulars, syllabi, attendance policies, fee policies.\n\n"
        "Return ONLY valid JSON with one key 'route' whose value is exactly one of: "
        '"SQL_ONLY", "RAG_ONLY", "HYBRID".\n\n'
        "Rules:\n"
        '- SQL_ONLY: question asks for specific numbers/records from tables (e.g. attendance %, marks, student list).\n'
        '- RAG_ONLY: question asks about policies, rules, procedures, regulations, handbooks, syllabi.\n'
        '- HYBRID: question needs BOTH hard numbers AND policy context '
        '(e.g. "who is below the minimum attendance threshold?", "which students fail the regulation cutoff?").\n\n'
        f"Question: {question}\n\n"
        'JSON response (only the JSON, nothing else):'
    )

    try:
        result = llm_service.generate(
            prompt=prompt,
            model=model,
            temperature=0.0,
            num_predict=30,
            num_ctx=512,
        )
    except Exception:
        return RAG_ONLY

    raw = result.get("response", "").strip()
    # Try to extract JSON even if model adds surrounding text
    m = re.search(r'\{.*?"route"\s*:\s*"(SQL_ONLY|RAG_ONLY|HYBRID)".*?\}', raw, re.DOTALL)
    if m:
        return m.group(1)
    # Fallback: keyword scan
    for label in (HYBRID, SQL_ONLY, RAG_ONLY):
        if label in raw.upper():
            return label
    return RAG_ONLY


# ─── Step 2a: SQL sub-task ───────────────────────────────────────────────────

def run_sql(
    question: str,
    role: str,
    tables: list[str],
    schema: str,
    model: str | None = None,
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

    prompt = (
        f"/no_think SQLite expert. Output ONLY a SELECT SQL query — no explanation, no markdown.\n\n"
        f"Tables:\n{schema}\n\n"
        f"{role_note}"
        "Rules: use ONLY column names from the schema above; numeric columns compare as numbers; "
        "no markdown, no comments; end with semicolon.\n\n"
        f"Question: {question}\n"
        "SQL:"
    )

    try:
        result = llm_service.generate(
            prompt=prompt,
            model=model,
            temperature=0.0,
            num_predict=120,
            num_ctx=2048,
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

def run_rag(question: str, role: str, k: int = 4) -> dict:
    """
    Retrieve top-k role-filtered chunks from ChromaDB.
    Returns { chunks: [(text, source, section, distance)], sources }.
    Does NOT call the LLM — that happens in the synthesis step.
    """
    embedder = _get_embedder()
    q_vec = embedder.encode([question], normalize_embeddings=True).tolist()

    try:
        col = _get_collection()
        results = col.query(
            query_embeddings=q_vec,
            n_results=k,
            where={f"role_{role}": True},
        )
    except Exception as e:
        return {"chunks": [], "sources": [], "error": str(e)}

    docs   = results["documents"][0]
    metas  = results["metadatas"][0]
    dists  = results["distances"][0]

    chunks = [(doc, m["source"], m["section"], round(d, 4))
              for doc, m, d in zip(docs, metas, dists)]
    sources = [{"source": m["source"], "section": m["section"], "distance": round(d, 4)}
               for m, d in zip(metas, dists)]

    return {"chunks": chunks, "sources": sources, "error": None}


# ─── Step 3: Synthesis ────────────────────────────────────────────────────────

def synthesize(
    question: str,
    role: str,
    route: str,
    sql_data: dict | None,
    rag_data: dict | None,
    model: str | None = None,
) -> str:
    """
    Build a grounded synthesis prompt fusing SQL rows + RAG chunks and call the LLM.
    """
    sections = []

    if sql_data and sql_data.get("result") and not sql_data.get("error"):
        rows = sql_data["result"]
        cols = sql_data["columns"]
        # Render up to 50 rows as a compact table string
        header = " | ".join(cols)
        divider = "-" * len(header)
        rows_str = "\n".join(
            " | ".join(str(row.get(c, "")) for c in cols)
            for row in rows[:50]
        )
        suffix = f"\n... ({len(rows) - 50} more rows)" if len(rows) > 50 else ""
        sections.append(
            f"[STRUCTURED DATA — SQL result ({len(rows)} rows)]\n"
            f"Query: {sql_data['sql']}\n\n"
            f"{header}\n{divider}\n{rows_str}{suffix}"
        )
    elif sql_data and sql_data.get("error"):
        sections.append(f"[STRUCTURED DATA — unavailable: {sql_data['error']}]")

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

    prompt = (
        "/no_think You are an institutional AI assistant for RVCE, Bengaluru.\n"
        "Answer ONLY from the context provided below. Do not use any external knowledge.\n\n"
        "Rules:\n"
        "- Cite document sources as [filename › section] when you use them.\n"
        "- If context does not contain a clear answer, say exactly: "
        "'I could not find this in the available data.'\n"
        "- Never invent numbers, dates, or rules.\n"
        f"- {route_instruction}\n"
        "- Be concise: 3–8 sentences or a short list.\n"
        f"{combined_context}\n\n"
        f"Question ({role}): {question}\n\n"
        "Answer:"
    )

    try:
        result = llm_service.generate(
            prompt=prompt,
            model=model,
            temperature=0.1,
            num_predict=350,
            num_ctx=3072,
        )
    except RuntimeError as e:
        return f"[LLM error: {e}]"

    return result.get("response", "").strip() or "I could not find this in the available data."


# ─── Main entry point ─────────────────────────────────────────────────────────

def ask(question: str, role: str, model: str | None = None) -> dict:
    """
    Unified hybrid query entry point.

    Args:
        question: User's natural-language question.
        role:     One of 'student', 'faculty', 'hod', 'admin'.
        model:    Generation model (None = active model from llm_service).

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
    route = route_query(question, tables, model)

    # ── 2. Run sub-tasks (SQL and/or RAG; parallel when HYBRID) ──────────────
    sql_data: dict | None = None
    rag_data: dict | None = None

    if route == HYBRID:
        with ThreadPoolExecutor(max_workers=2) as pool:
            sql_future = pool.submit(run_sql, question, role, tables, schema, model)
            rag_future = pool.submit(run_rag, question, role)
            sql_data = sql_future.result()
            rag_data = rag_future.result()
    elif route == SQL_ONLY:
        sql_data = run_sql(question, role, tables, schema, model)
    elif route == RAG_ONLY:
        rag_data = run_rag(question, role)

    # ── 3. Synthesize final answer ────────────────────────────────────────────
    answer = synthesize(question, role, route, sql_data, rag_data, model)

    time_taken_ms = round((time.time() - t0) * 1000)

    return {
        "answer":        answer,
        "route":         route,
        "sql_query":     sql_data.get("sql") if sql_data else None,
        "sql_result":    sql_data.get("result") if sql_data else None,
        "sql_columns":   sql_data.get("columns") if sql_data else None,
        "sql_row_count": sql_data.get("row_count") if sql_data else None,
        "sql_error":     sql_data.get("error") if sql_data else None,
        "doc_sources":   rag_data.get("sources", []) if rag_data else [],
        "time_taken_ms": time_taken_ms,
    }
