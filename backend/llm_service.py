"""
backend/llm_service.py
Centralized LLM generation service.

All AI modules (chat, ask-sql, ask-docs) must call generate() from here.
Active model is shared across all modules and can be switched at runtime.

Thread-safety: _active_model is protected by a threading.Lock so concurrent
requests cannot race when switching models.
"""

import json
import threading
import requests
from backend.config import (
    OLLAMA_GENERATE_URL,
    OLLAMA_CHAT_URL,
    OLLAMA_TAGS_URL,
    DEFAULT_MODEL,
)

# ── Active model state & GPU serialization ────────────────────────────────────
_lock = threading.Lock()
_llm_semaphore = threading.Semaphore(1)  # Serialize non-streaming LLM calls for GPU VRAM
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
        "keep_alive": -1,   # keep model loaded in GPU VRAM indefinitely
    }
    if options:
        payload["options"] = options

    if stream:
        try:
            resp = requests.post(
                OLLAMA_GENERATE_URL,
                json=payload,
                stream=True,
                timeout=120,
            )
            resp.raise_for_status()
            return resp  # caller iterates the streaming response
        except requests.exceptions.ConnectionError:
            raise RuntimeError(
                f"Cannot reach Ollama at {OLLAMA_GENERATE_URL}. "
                "Make sure Ollama is running. "
                "If running in WSL, set OLLAMA_BASE_URL=http://172.28.224.1:11434 in your .env file."
            )
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Ollama request failed: {e}")

    with _llm_semaphore:
        try:
            resp = requests.post(
                OLLAMA_GENERATE_URL,
                json=payload,
                stream=False,
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

        return resp.json()


def format_history(history: list[dict] | None, max_turns: int = 6) -> str:
    """Format recent turns from the current chat session into a compact prompt block."""
    if not history:
        return ""
    lines = []
    for turn in history[-max_turns:]:
        role = str(turn.get("role", "")).strip().lower()
        content = str(turn.get("content", "")).strip()
        if role not in ("user", "assistant") or not content:
            continue
        label = "User" if role == "user" else "Assistant"
        lines.append(f"{label}: {content[:400]}")
    if not lines:
        return ""
    return "Previous conversation in this chat:\n" + "\n".join(lines) + "\n\n"


def contextualize_search_query(question: str, history: list[dict] | None) -> str:
    """
    If the current question is a follow-up referencing earlier turns in this chat,
    combine it with the most recent user turn so vector retrieval stays on topic.
    """
    if not history:
        return question
    last_user = next(
        (str(t.get("content", "")).strip() for t in reversed(history)
         if str(t.get("role", "")).lower() == "user" and str(t.get("content", "")).strip()),
        "",
    )
    if not last_user:
        return question
    q_words = question.lower().split()
    followup_markers = {"it", "them", "those", "that", "these", "this", "above", "same", "they", "he", "she", "their", "her", "his"}
    if len(q_words) <= 8 or any(w.strip("?.,!") in followup_markers for w in q_words):
        return f"{last_user} {question}"
    return question


def stream_chat(
    prompt: str | None = None,
    messages: list[dict] | None = None,
    model: str | None = None,
    **options,
):
    """
    Generator yielding UTF-8 text chunks from Ollama (/api/chat or /api/generate),
    serialized by _llm_semaphore and closing the upstream stream on disconnect/Stop.
    """
    resolved_model = model or get_active_model()
    use_chat = bool(messages)
    url = OLLAMA_CHAT_URL if use_chat else OLLAMA_GENERATE_URL
    payload: dict = {
        "model": resolved_model,
        "stream": True,
        "think": False,
        "keep_alive": -1,
    }
    if use_chat:
        payload["messages"] = messages
    else:
        payload["prompt"] = prompt or ""
    if options:
        payload["options"] = options

    with _llm_semaphore:
        try:
            resp = requests.post(url, json=payload, stream=True, timeout=120)
            resp.raise_for_status()
        except requests.exceptions.ConnectionError:
            raise RuntimeError(
                f"Cannot reach Ollama at {url}. "
                "Make sure Ollama is running."
            )
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Ollama request failed: {e}")

        try:
            for raw_line in resp.iter_lines(decode_unicode=True):
                if not raw_line:
                    continue
                try:
                    record = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue
                if record.get("error"):
                    raise RuntimeError(str(record["error"]))
                text = (record.get("message") or {}).get("content") or record.get("response")
                if isinstance(text, str) and text:
                    yield text.encode("utf-8")
                if record.get("done"):
                    break
        finally:
            resp.close()

