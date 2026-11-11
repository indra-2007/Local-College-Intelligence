"""
backend/config.py
Centralized configuration for the Institutional AI Backend.

All Ollama URLs and model settings are read from environment variables.
Set them in a .env file or export them before starting uvicorn.

Defaults assume Ollama runs on the same Windows host that runs this backend.
When running inside WSL, the Windows host is reachable at the IP printed by:
    ip route show default | awk '{print $3}'
  (typically 172.28.224.1)

When running natively on Windows (not WSL), use http://127.0.0.1:11434.
"""

import os
from dotenv import load_dotenv

# Load .env file from the project root (one level above backend/)
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(_root, ".env"))

# ── Ollama ────────────────────────────────────────────────────────────────────
# Change OLLAMA_BASE_URL in .env if your setup differs.
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_GENERATE_URL: str = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_TAGS_URL: str = f"{OLLAMA_BASE_URL}/api/tags"

# ── Default generation model ──────────────────────────────────────────────────
# Must be a model already pulled in Ollama. Never auto-downloaded.
DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "qwen2.5-coder:7b")

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH: str = os.path.join(_root, "data", "institutional.db")

# ── ChromaDB ──────────────────────────────────────────────────────────────────
CHROMA_DIR: str = os.path.join(_root, "data", "chroma")
CHROMA_COLLECTION: str = "institutional_docs"

# ── Embedding model (CPU, local — NEVER changes with generation model) ─────────
EMBED_MODEL: str = "all-MiniLM-L6-v2"

