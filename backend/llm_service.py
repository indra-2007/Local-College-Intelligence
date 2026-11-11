"""
backend/llm_service.py
Centralized LLM generation service.

All AI modules (chat, ask-sql, ask-docs) must call generate() from here.
Active model is shared across all modules and can be switched at runtime.

Thread-safety: _active_model is protected by a threading.Lock so concurrent
requests cannot race when switching models.
"""

import threading
import requests
from backend.config import (
    OLLAMA_GENERATE_URL,
    OLLAMA_TAGS_URL,
    DEFAULT_MODEL,
)

# ── Active model state ────────────────────────────────────────────────────────
_lock = threading.Lock()
_active_model: str = DEFAULT_MODEL


def get_active_model() -> str:
    """Return the currently active generation model name."""
    with _lock:
        return _active_model


def get_installed_models() -> list[dict]:
    """
    Query Ollama for installed models.
    Returns a list of model info dicts (name, size, etc.).
    Raises RuntimeError if Ollama is unreachable.
    Never downloads models automatically.
    """
    try:
        resp = requests.get(OLLAMA_TAGS_URL, timeout=5)
        resp.raise_for_status()
        return resp.json().get("models", [])
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Cannot reach Ollama at {OLLAMA_TAGS_URL}: {e}")


def set_active_model(name: str) -> bool:
    """
    Switch the active generation model.
    Validates that the model is already installed in Ollama.
    Returns True on success. Raises ValueError if model is not installed.
    Never auto-downloads models.
    """
    global _active_model
    models = get_installed_models()
    installed_names = [m["name"] for m in models]
    if name not in installed_names:
        raise ValueError(
            f"Model '{name}' is not installed in Ollama. "
            f"Installed models: {installed_names}. "
            "Pull it first with: ollama pull <model-name>"
        )
    with _lock:
        _active_model = name
    return True


def generate(
    prompt: str,
    model: str | None = None,
    stream: bool = False,
    **options,
) -> dict:
    """
    Send a generation request to Ollama.

    Args:
        prompt:  The full prompt string.
        model:   Model name to use. If None, uses the active model.
        stream:  Whether to request a streaming response (returns raw response).
        **options: Ollama generation options (temperature, num_predict, etc.)

    Returns:
        Parsed JSON response dict from Ollama (when stream=False).
        Raw requests.Response object (when stream=True — caller handles streaming).

    Raises:
        RuntimeError: If Ollama is unreachable or returns an error.
    """
    resolved_model = model or get_active_model()

    payload = {
        "model": resolved_model,
        "prompt": prompt,
        "stream": stream,
        "think": False,
    }
    if options:
        payload["options"] = options

    try:
        resp = requests.post(
            OLLAMA_GENERATE_URL,
            json=payload,
            stream=stream,
            timeout=120,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            f"Cannot reach Ollama at {OLLAMA_GENERATE_URL}. "
            "Make sure Ollama is running. "
            "If running in WSL, set OLLAMA_BASE_URL=http://172.28.224.1:11434 in your .env file."
        )
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Ollama request failed: {e}")

    if stream:
        return resp  # caller iterates the streaming response

    return resp.json()

