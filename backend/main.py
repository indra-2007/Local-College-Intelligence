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
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# ─── Config ───────────────────────────────────────────────────────────────────
from backend.config import DB_PATH, DEFAULT_MODEL, OLLAMA_GENERATE_URL
import backend.llm_service as llm_service

app = FastAPI(title="Institutional AI Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Next.js server proxies all requests — browsers never hit this directly
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """
    1. Create auth/chat DB tables and seed dev accounts if not present.
    2. Warmup Ollama so the first real query isn't slow.
    """
    # Ensure auth + chat persistence tables exist
    from backend.auth_storage import init_storage_db as _init_db
    _init_db()

    # Warmup: send a no-op request so model weights are in RAM
    try:
        llm_service.generate(
            prompt="hi",
            model=llm_service.get_active_model(),
            num_predict=1,
            num_ctx=512,
        )
    except Exception:
        pass  # non-fatal — server still starts even if Ollama is not yet up


# ─── Helpers ──────────────────────────────────────────────────────────────────

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
    """
    Return (table_names_list, schema_text) where schema_text has one clearly
    separated block per table so the LLM can unambiguously map questions to
    the correct table.
    """
    conn = get_db()
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cur.fetchall()]
    blocks = []
    for t in tables:
        cur2 = conn.execute(f"PRAGMA table_info({t});")
        cols = cur2.fetchall()
        col_names = [c[1] for c in cols]
        col_defs = ", ".join(f"{c[1]} {c[2]}" for c in cols)

        lines = []
        lines.append(f"[{t}] Columns: {col_defs}")
        # 1 sample row is enough for the LLM to see value types
        try:
            cur3 = conn.execute(f'SELECT * FROM "{t}" LIMIT 1;')
            row = cur3.fetchone()
            if row:
                sample = ", ".join(
                    f"{col_names[j]}={repr(v)}" for j, v in enumerate(row)
                )
                lines.append(f"    e.g. {sample}")
        except Exception:
            pass
        blocks.append("\n".join(lines))
    conn.close()
    schema_text = "\n\n".join(blocks)
    return tables, schema_text


def is_safe_sql(sql: str) -> bool:
    """Block destructive SQL — LLM output is never trusted for writes."""
    forbidden = ["drop", "delete", "update", "insert", "alter", "truncate", "create", "attach"]
    return not any(word in sql.lower() for word in forbidden)


def extract_sql(raw: str) -> str:
    """Strip markdown fences and explanatory text, return just the SQL."""
    # Try ```sql ... ``` block first
    match = re.search(r"```(?:sql)?\s*(SELECT.*?)```", raw, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip().rstrip(";")
    # Fall back: grab everything from first SELECT to end of string
    match = re.search(r"(SELECT\b.*)", raw, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip().rstrip(";")
    return raw.strip()


# ─── Model Management Routes ──────────────────────────────────────────────────

@app.get("/models")
def get_models():
    """Return all models currently installed in Ollama."""
    try:
        models = llm_service.get_installed_models()
        return {
            "models": [m["name"] for m in models],
            "active": llm_service.get_active_model(),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/models/active")
def get_active_model():
    """Return the currently active generation model."""
    return {"active_model": llm_service.get_active_model()}


class SetModelRequest(BaseModel):
    model: str


@app.post("/models/active")
def set_active_model(req: SetModelRequest):
    """
    Switch the active generation model.
    Model must already be installed in Ollama — never auto-downloads.
    """
    try:
        llm_service.set_active_model(req.model)
        return {"status": "ok", "active_model": req.model}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ─── Health & Tables ──────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "db": DB_PATH,
        "tables": list_tables(),
        "active_model": llm_service.get_active_model(),
        "ollama_url": OLLAMA_GENERATE_URL,
    }


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


# ─── Directories ─────────────────────────────────────────────────────────────
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STRUCTURED_DIR = os.path.join(ROOT_DIR, "structured_data")
UNSTRUCTURED_DIR = os.path.join(ROOT_DIR, "unstructured_data", "synthetic")


# ─── Upload ───────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Receive a file from the frontend:
    - If .md / .txt: Save to unstructured_data/synthetic/ and rebuild RAG ChromaDB index.
    - If .csv / .xlsx / .xls / .json: Save to structured_data/ and load into SQLite table.
    """
    filename = file.filename or "upload"
    name, ext = os.path.splitext(filename)
    ext = ext.lower()

    raw_bytes = await file.read()

    # ── 1. Unstructured documents for RAG (.md, .txt) ──
    if ext in (".md", ".txt"):
        os.makedirs(UNSTRUCTURED_DIR, exist_ok=True)
        clean_filename = re.sub(r"[^\w\.\-]", "_", filename)
        target_path = os.path.join(UNSTRUCTURED_DIR, clean_filename)
        with open(target_path, "wb") as f:
            f.write(raw_bytes)

        # Trigger RAG ingest
        indexing_error = None
        try:
            import backend.ingest as ingest
            ingest.build_index()
            # Invalidate cached Chroma collection in rag.py
            import backend.rag as rag
            rag._chroma_col = None
        except Exception as e:
            indexing_error = str(e)

        return {
            "status": "ok",
            "type": "unstructured",
            "filename": clean_filename,
            "saved_path": f"unstructured_data/synthetic/{clean_filename}",
            "message": f"Saved to unstructured_data/synthetic/{clean_filename}" + (
                f" and indexed into ChromaDB." if not indexing_error else f", but indexing note: {indexing_error}"
            ),
        }

    # ── 2. Structured data for SQL (.csv, .xlsx, .xls, .json) ──
    table_name = re.sub(r"[^a-z0-9_]", "_", name.lower()).strip("_")
    if not table_name:
        raise HTTPException(status_code=400, detail="Invalid filename")

    os.makedirs(STRUCTURED_DIR, exist_ok=True)
    clean_filename = re.sub(r"[^\w\.\-]", "_", filename)
    target_path = os.path.join(STRUCTURED_DIR, clean_filename)
    with open(target_path, "wb") as f:
        f.write(raw_bytes)

    try:
        def _read(raw: bytes, ext: str, skip: int = 0):
            if ext in (".csv", ""):
                return pd.read_csv(io.BytesIO(raw), skiprows=skip)
            return pd.read_excel(io.BytesIO(raw), skiprows=skip)

        def _has_title_row(df) -> bool:
            """Return True if the first row looks like a banner/title, not real headers."""
            unnamed = sum(1 for c in df.columns if str(c).startswith("Unnamed:"))
            first = str(df.columns[0])
            if unnamed > len(df.columns) / 2:
                return True
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
            raise HTTPException(status_code=400, detail=f"Unsupported format '{ext}'. Use CSV, XLSX, JSON, or MD/TXT.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")

    df.columns = [re.sub(r"[^a-z0-9_]", "_", str(c).strip().lower()) for c in df.columns]

    # Clean percentage strings → real numbers
    for col in df.select_dtypes(include=['object', 'str']).columns:
        non_null = df[col].dropna()
        if len(non_null) == 0:
            continue
        str_vals = non_null.astype(str).str.strip()
        pct_matches = str_vals[str_vals.str.match(r"^\d+(\.\d+)?%$")]
        if len(pct_matches) > 0 and (len(pct_matches) / len(str_vals)) > 0.5:
            df[col] = pd.to_numeric(
                df[col].astype(str).str.strip().str.rstrip("%"),
                errors="coerce",
            )

    conn = get_db()
    df.to_sql(table_name, conn, if_exists="replace", index=False)
    conn.close()

    return {
        "status": "ok",
        "type": "structured",
        "table": table_name,
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(3).to_dict(orient="records"),
        "saved_path": f"structured_data/{clean_filename}",
        "message": f"Saved to structured_data/{clean_filename} and loaded into SQLite table '{table_name}'.",
    }


@app.get("/documents")
def list_documents():
    """List all RAG documents stored in unstructured_data/synthetic."""
    if not os.path.exists(UNSTRUCTURED_DIR):
        return {"documents": []}
    docs = []
    for f in sorted(os.listdir(UNSTRUCTURED_DIR)):
        if f.endswith((".md", ".txt")):
            full_path = os.path.join(UNSTRUCTURED_DIR, f)
            size = os.path.getsize(full_path)
            docs.append({"name": f, "size": size})
    return {"documents": docs}


# ─── Ask SQL ──────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    prompt: str
    model: str | None = None  # None = use active model


@app.post("/ask-sql")
def ask_sql(req: AskRequest):
    """
    Full pipeline:
    1. Build schema-aware few-shot prompt with clearly separated table blocks
    2. LLM generates SQL text only
    3. Safety gate: reject anything destructive
    4. Python (not LLM) executes SELECT against SQLite
    5. Return results + generated SQL for transparency
    """
    tables, schema = get_schema()
    if not tables:
        raise HTTPException(status_code=400, detail="No data uploaded yet. Upload a CSV first.")

    prompt = (
        "/no_think SQLite expert. Output ONLY a SELECT SQL query — no explanation, no markdown.\n\n"
        f"Tables:\n{schema}\n\n"
        "Rules: use ONLY column names from the schema above; pick the table whose columns match the question; "
        "numeric columns compare as numbers (e.g. WHERE attendance__ < 80, not < '80%'); "
        "no markdown, no comments; end with semicolon.\n\n"
        f"Question: {req.prompt}\n"
        "SQL:"
    )

    try:
        result = llm_service.generate(
            prompt=prompt,
            model=req.model,  # None = use shared active model
            temperature=0.0,
            num_predict=120,
            num_ctx=2048,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    raw_sql = result.get("response", "").strip()
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


# ─── Table Preview & Delete ───────────────────────────────────────────────────

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
    if table_name not in list_tables():
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found.")
    safe_name = re.sub(r"[^a-z0-9_]", "", table_name)
    conn = get_db()
    conn.execute(f'DROP TABLE IF EXISTS "{safe_name}";')
    conn.commit()
    conn.close()
    return {"status": "deleted", "table": table_name}


# ─── RAG / Unstructured docs ──────────────────────────────────────────────────

class AskDocsRequest(BaseModel):
    question: str
    role: str  # "student" | "faculty" | "hod" | "admin"
    model: str | None = None  # None = use active model


@app.post("/ask-docs")
def ask_docs(req: AskDocsRequest):
    """
    RAG pipeline for unstructured institutional documents stored in ChromaDB.

    Pipeline:
      1. Validate role (server-side; see security note below).
      2. Embed question with sentence-transformers (CPU, local).
      3. Query ChromaDB with role filter — restricted chunks NEVER leave the DB.
      4. Pass retrieved context + question to Ollama; return answer + sources.

    SECURITY NOTE (PROTOTYPE):
      Role is currently taken directly from the request body for ease of development.
      In production, role MUST be derived from a verified server-side session token
      (e.g. JWT signed by the auth service). Never trust the client or the LLM prompt
      for access-control decisions.
    """
    from backend.rag import answer_question  # lazy import so main.py starts fast

    try:
        result = answer_question(
            question=req.question,
            role=req.role,
            model=req.model,  # None = use active model (resolved inside rag.py)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return result


# ─── Authentication ───────────────────────────────────────────────────────────

from backend.auth_storage import (
    authenticate_user,
    create_auth_session,
    get_user_by_token,
    delete_auth_session,
    init_storage_db,
)
from fastapi import Header


def _get_current_user(authorization: Optional[str] = Header(default=None)):
    """Dependency: extract and validate Bearer token from Authorization header."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid token.")
    return user


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/login")
def login(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_auth_session(user["id"])
    return {"status": "ok", "user": user, "token": token}


@app.get("/auth/me")
def me(authorization: Optional[str] = Header(default=None)):
    user = _get_current_user(authorization)
    return {"user": user}


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    if token:
        delete_auth_session(token)
    return {"status": "ok"}


# ─── Chat History ─────────────────────────────────────────────────────────────

from backend.auth_storage import (
    get_user_chat_sessions,
    get_chat_session,
    upsert_chat_session,
    delete_chat_session,
)


@app.get("/chats")
def list_chats(authorization: Optional[str] = Header(default=None)):
    """Return all chat sessions for the authenticated user."""
    user = _get_current_user(authorization)
    sessions = get_user_chat_sessions(user["id"])
    return sessions


class ChatSessionBody(BaseModel):
    id: Optional[str] = None
    title: str = "Untitled chat"
    model: str = "qwen2.5-coder:7b"
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    messages: list = []


@app.post("/chats")
def save_chat(body: ChatSessionBody, authorization: Optional[str] = Header(default=None)):
    """Create or update a chat session and all its messages."""
    user = _get_current_user(authorization)
    try:
        result = upsert_chat_session(body.model_dump(), user["id"])
    except PermissionError:
        raise HTTPException(status_code=403, detail="This conversation belongs to another user.")
    return result


@app.get("/chats/{session_id}")
def get_chat(session_id: str, authorization: Optional[str] = Header(default=None)):
    """Get a single chat session by ID (must belong to authenticated user)."""
    user = _get_current_user(authorization)
    session = get_chat_session(session_id, user["id"])
    if not session:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return session


@app.delete("/chats/{session_id}")
def delete_chat(session_id: str, authorization: Optional[str] = Header(default=None)):
    """Delete a chat session (must belong to authenticated user)."""
    user = _get_current_user(authorization)
    deleted = delete_chat_session(session_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found or access denied.")
    return {"status": "deleted", "id": session_id}

