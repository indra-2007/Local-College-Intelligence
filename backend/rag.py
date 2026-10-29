"""
backend/rag.py
RAG (Retrieval-Augmented Generation) pipeline for unstructured institutional docs.

Flow:
  question + role
    → embed question (sentence-transformers, CPU)
    → query ChromaDB with role filter (access control INSIDE the DB, before any text leaves)
    → build prompt with retrieved context
    → call Ollama /api/generate (local, no internet)
    → return answer + sources

SECURITY NOTE: role filtering is done inside the Chroma query (where={"role_<role>": True}).
This means restricted chunks are never retrieved and never reach the LLM.
Role is currently accepted from the request body for prototyping — in production it MUST
come from a verified server-side session token, never from the client or the LLM prompt.
"""

import os
import requests

# ─── Config ───────────────────────────────────────────────────────────────────

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHROMA_DIR = os.path.join(ROOT, "data", "chroma")
COLLECTION = "institutional_docs"
EMBED_MODEL = "all-MiniLM-L6-v2"
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
DEFAULT_MODEL = "qwen3-4b"
VALID_ROLES = ["student", "faculty", "hod", "admin"]

# ─── Module-level lazy singletons ─────────────────────────────────────────────
# Loaded once on first call; avoids reloading the 80 MB model on every request.

_embedder = None
_chroma_col = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer(EMBED_MODEL)
    return _embedder


def _get_collection():
    global _chroma_col
    if _chroma_col is None:
        import chromadb
        client = chromadb.PersistentClient(path=CHROMA_DIR)
        _chroma_col = client.get_collection(COLLECTION)
    return _chroma_col


# ─── Main function ─────────────────────────────────────────────────────────────

def answer_question(
    question: str,
    role: str,
    model: str = DEFAULT_MODEL,
    k: int = 4,
) -> dict:
    """
    Retrieve relevant chunks from ChromaDB (role-filtered) and generate an answer via Ollama.

    Returns:
        {
            "answer": str,
            "sources": [{"source": str, "section": str, "distance": float}],
            "role": str,
        }

    Raises:
        ValueError  — invalid role
        RuntimeError — Ollama unreachable or ChromaDB not initialised
    """
    # ── 1. Validate role ──────────────────────────────────────────────────────
    role = role.strip().lower()
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of {VALID_ROLES}.")

    # ── 2. Embed question ─────────────────────────────────────────────────────
    embedder = _get_embedder()
    q_vec = embedder.encode([question], normalize_embeddings=True).tolist()

    # ── 3. Query ChromaDB with role filter ────────────────────────────────────
    # The where-filter runs INSIDE Chroma before any documents are returned.
    # Chunks that the role cannot access are never retrieved.
    try:
        col = _get_collection()
        results = col.query(
            query_embeddings=q_vec,
            n_results=k,
            where={f"role_{role}": True},
        )
    except Exception as e:
        raise RuntimeError(
            f"ChromaDB query failed: {e}. "
            "Have you run `python backend/ingest.py` to build the index?"
        )

    docs = results["documents"][0]       # list of k strings
    metas = results["metadatas"][0]      # list of k metadata dicts
    dists = results["distances"][0]      # list of k floats (cosine distances)

    if not docs:
        return {
            "answer": "I could not find this in the available documents.",
            "sources": [],
            "role": role,
        }

    # ── 4. Build sources list ─────────────────────────────────────────────────
    sources = [
        {"source": m["source"], "section": m["section"], "distance": round(d, 4)}
        for m, d in zip(metas, dists)
    ]

    # ── 5. Build context block ────────────────────────────────────────────────
    context_parts = []
    for doc, meta in zip(docs, metas):
        cite = f"[{meta['source']} > {meta['section']}]"
        context_parts.append(f"{cite}\n{doc}")
    context = "\n\n---\n\n".join(context_parts)

    # ── 6. Build prompt ───────────────────────────────────────────────────────
    prompt = (
        "/no_think "
        "You are an institutional AI assistant for RVCE, Bengaluru. "
        "Answer ONLY from the context provided below. Do not use any external knowledge.\n\n"
        "Rules:\n"
        "- Cite your sources as [filename > section] when you use information from a chunk.\n"
        "- If the context does not contain a clear answer, say exactly: "
        "'I could not find this in the available documents.' Do not guess.\n"
        "- Never invent numbers, dates, or rules.\n"
        "- If the context mentions rules from different schemes (e.g. 2022 vs 2024 regulations), "
        "state both and name each scheme explicitly.\n"
        "- Be concise: 3–6 sentences is ideal unless the question needs a list.\n\n"
        f"Context:\n{context}\n\n"
        f"Question ({role}): {question}\n\n"
        "Answer:"
    )

    # ── 7. Call Ollama ────────────────────────────────────────────────────────
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "think": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 300,
                    "num_ctx": 4096,
                },
            },
            timeout=120,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            f"Cannot reach Ollama at {OLLAMA_URL}. "
            "Is the SSH tunnel open? (ssh -N -L 11434:localhost:11434 indra@<server>)"
        )
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Ollama request failed: {e}")

    answer = resp.json().get("response", "").strip()
    if not answer:
        answer = "I could not find this in the available documents."

    return {
        "answer": answer,
        "sources": sources,
        "role": role,
    }
