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

def _resolve_ollama_base_url() -> str:
    # 1. Explicit env var always wins
    env_url = os.getenv("OLLAMA_BASE_URL")
    if env_url:
        return env_url.rstrip("/")

    # 2. If running inside WSL, Windows host is the default gateway / nameserver
    try:
        if os.path.exists("/proc/version"):
            with open("/proc/version", "r") as f:
                if "microsoft" in f.read().lower():
                    # Read nameserver from /etc/resolv.conf
                    if os.path.exists("/etc/resolv.conf"):
                        with open("/etc/resolv.conf", "r") as rf:
                            for line in rf:
                                if line.strip().startswith("nameserver"):
                                    host_ip = line.split()[1].strip()
                                    return f"http://{host_ip}:11434"
    except Exception:
        pass

    # 3. Default to localhost (native Windows, native Linux, or mirrored networking)
    return "http://127.0.0.1:11434"


# ── Ollama ────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL: str = _resolve_ollama_base_url()
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

