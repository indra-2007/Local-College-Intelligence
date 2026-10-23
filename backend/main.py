"""
Institutional AI Backend
Pipeline: Upload CSV → SQLite → LLM generates SQL → Python executes SQL → result returned
"""

import os
import sqlite3
import re
import io
import requests
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Config ──────────────────────────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "institutional.db")
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"  # Ollama native port on Ubuntu
DEFAULT_MODEL = "qwen3:4b"

app = FastAPI(title="Institutional AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return sqlite3.connect(DB_PATH)


def list_tables():
    conn = get_db()
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cur.fetchall()]
    conn.close()
    return tables


def get_schema():
    """Return all table schemas as readable text — injected into LLM prompt."""
    conn = get_db()
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cur.fetchall()]
    parts = []
    for t in tables:
        cur2 = conn.execute(f"PRAGMA table_info({t});")
        cols = cur2.fetchall()
        col_defs = ", ".join(f"{c[1]} {c[2]}" for c in cols)
        parts.append(f"Table: {t}({col_defs})")
    conn.close()
    return "\n".join(parts)


def is_safe_sql(sql: str) -> bool:
    """Block destructive SQL — LLM output is never trusted for writes."""
    forbidden = ["drop", "delete", "update", "insert", "alter", "truncate", "create", "attach"]
    return not any(word in sql.lower() for word in forbidden)


def extract_sql(raw: str) -> str:
    """Strip markdown fences and explanatory text, return just the SQL."""
    # Try ```sql ... ``` block first
    match = re.search(r"```(?:sql)?\s*(SELECT.*?)```", raw, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip()
    # Fall back: grab from first SELECT
    match = re.search(r"(SELECT\b.*?)(?:;|$)", raw, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip().rstrip(";")
    return raw.strip()


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "db": DB_PATH, "tables": list_tables()}


@app.get("/tables")
def get_tables():
    tables = list_tables()
    conn = get_db()
    result = {}
    for t in tables:
        cur = conn.execute(f"SELECT COUNT(*) FROM {t};")
        result[t] = {"rows": cur.fetchone()[0]}
    conn.close()
    return {"tables": result}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Receive a CSV/Excel/JSON from the frontend.
    Save to disk → load into SQLite → return table name + preview.
    """
    filename = file.filename or "upload"
    name, ext = os.path.splitext(filename)
    ext = ext.lower()

    # Sanitise into a valid SQLite table name
    table_name = re.sub(r"[^a-z0-9_]", "_", name.lower()).strip("_")
    if not table_name:
        raise HTTPException(status_code=400, detail="Invalid filename")

    raw_bytes = await file.read()

    try:
        def _read(raw: bytes, ext: str, skip: int = 0):
            if ext in (".csv", ""):
                return pd.read_csv(io.BytesIO(raw), skiprows=skip)
            return pd.read_excel(io.BytesIO(raw), skiprows=skip)

        def _has_title_row(df) -> bool:
            """Return True if the first row looks like a banner/title, not real headers."""
            unnamed = sum(1 for c in df.columns if str(c).startswith("Unnamed:"))
            first = str(df.columns[0])
            # Case 1: most columns unnamed (blank title row)
            if unnamed > len(df.columns) / 2:
                return True
            # Case 2: first column is a long sentence (e.g. "Student Master & Course…")
            if len(first) > 25 and (" " in first or "&" in first):
                return True
            return False

        if ext in (".csv", ""):
            df = _read(raw_bytes, ext)
            if _has_title_row(df):
                df = _read(raw_bytes, ext, skip=1)
        elif ext in (".xlsx", ".xls"):
            df = _read(raw_bytes, ext)
            if _has_title_row(df):
                df = _read(raw_bytes, ext, skip=1)
        elif ext == ".json":
            df = pd.read_json(io.BytesIO(raw_bytes))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format '{ext}'. Use CSV, XLSX, or JSON.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")

    # Sanitise column names too
    df.columns = [re.sub(r"[^a-z0-9_]", "_", c.strip().lower()) for c in df.columns]

    conn = get_db()
    df.to_sql(table_name, conn, if_exists="replace", index=False)
    conn.close()

    return {
        "status": "ok",
        "table": table_name,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(3).to_dict(orient="records"),
    }


class AskRequest(BaseModel):
    prompt: str
    model: str = DEFAULT_MODEL


@app.post("/ask-sql")
def ask_sql(req: AskRequest):
    """
    Full pipeline:
    1. Build schema-aware few-shot prompt
    2. LLM generates SQL text only
    3. Safety gate: reject anything destructive
    4. Python (not LLM) executes SELECT against SQLite
    5. Return results + generated SQL for transparency
    """
    schema = get_schema()
    if not schema:
        raise HTTPException(status_code=400, detail="No data uploaded yet. Upload a CSV first.")

    prompt = (
        "/no_think You are a SQLite expert. Output ONLY a valid SELECT SQL query — no explanation, no markdown.\n\n"
        f"Database schema:\n{schema}\n\n"
        "Rules:\n"
        "- Only write SELECT statements\n"
        "- Use exact column names from the schema above\n"
        "- No comments, no markdown fences, no explanation\n\n"
        "Example:\n"
        "Schema: Table: attendance(student_id TEXT, date TEXT, present INTEGER)\n"
        "Question: How many students attended on 2024-01-15?\n"
        "SQL: SELECT COUNT(*) as count FROM attendance WHERE date = '2024-01-15' AND present = 1;\n\n"
        f"Question: {req.prompt}\n"
        "SQL:"
    )

    try:
        llm_resp = requests.post(
            OLLAMA_URL,
            json={
                "model": req.model,
                "prompt": prompt,
                "stream": False,
                "think": False,
                "options": {"temperature": 0.1, "num_predict": 256},
            },
            timeout=120,
        )
        llm_resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"LLM unreachable: {e}")

    raw_sql = llm_resp.json().get("response", "").strip()
    generated_sql = extract_sql(raw_sql)

    # Safety gate — never execute destructive SQL from LLM output
    if not is_safe_sql(generated_sql):
        return {
            "error": "Generated SQL contains forbidden operations. Rejected.",
            "generated_sql": generated_sql,
            "result": [],
        }

    if not generated_sql.upper().startswith("SELECT"):
        return {
            "error": "LLM did not produce a SELECT statement.",
            "generated_sql": generated_sql,
            "result": [],
        }

    # Python executes — NOT the LLM
    conn = get_db()
    try:
        result_df = pd.read_sql_query(generated_sql, conn)
    except Exception as e:
        conn.close()
        return {
            "error": f"SQL execution failed: {e}",
            "generated_sql": generated_sql,
            "result": [],
        }
    conn.close()

    return {
        "sql": generated_sql,
        "result": result_df.to_dict(orient="records"),
        "row_count": len(result_df),
        "columns": list(result_df.columns),
    }


@app.get("/preview/{table_name}")
def preview_table(table_name: str, limit: int = 10):
    if table_name not in list_tables():
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found.")
    conn = get_db()
    df = pd.read_sql_query(f"SELECT * FROM {table_name} LIMIT {limit};", conn)
    conn.close()
    return {"table": table_name, "columns": list(df.columns), "rows": df.to_dict(orient="records")}


@app.delete("/tables/{table_name}")
def delete_table(table_name: str):
    """Drop a table from SQLite — permanently deletes uploaded data."""
    # Validate table exists
    if table_name not in list_tables():
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found.")
    # Sanitise name to prevent SQL injection (even though it's our own list)
    safe_name = re.sub(r"[^a-z0-9_]", "", table_name)
    conn = get_db()
    conn.execute(f'DROP TABLE IF EXISTS "{safe_name}";')
    conn.commit()
    conn.close()
    return {"status": "deleted", "table": table_name}
