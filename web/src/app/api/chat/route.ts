import { NextResponse } from "next/server";
import { DEFAULT_MODEL, FASTAPI_URL, OLLAMA_URL } from "@/lib/campus-api";
import { currentSession } from "@/lib/current-session";

export const runtime = "nodejs";
type Turn = { role: "assistant" | "user"; content: string };

function isTurn(value: unknown): value is Turn {
  if (!value || typeof value !== "object") return false;
  return (
    "role" in value &&
    (value.role === "user" || value.role === "assistant") &&
    "content" in value &&
    typeof value.content === "string"
  );
}

// Ollama records and UTF-8 characters can straddle network chunks.
function responseText(body: ReadableStream<Uint8Array>) {
  let pending = "";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  function emit(line: string, out: TransformStreamDefaultController<Uint8Array>) {
    if (!line.trim()) return;
    const record = JSON.parse(line);
    if (record.error) throw new Error(String(record.error));
    const text = record.message?.content ?? record.response;
    if (typeof text === "string" && text) out.enqueue(encoder.encode(text));
  }
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, out) {
        const lines = (pending + decoder.decode(chunk, { stream: true })).split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) emit(line, out);
      },
      flush(out) {
        emit(pending + decoder.decode(), out);
      },
    })
  );
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      { error: "Session expired or not signed in. Please sign in again." },
      { status: 401 }
    );
  }

  let payload: { prompt?: string; model?: string; messages?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { prompt, model, messages } = payload;
  const chat = Array.isArray(messages) && messages.length > 0 && messages.every(isTurn);
  if (!chat && (typeof prompt !== "string" || !prompt.trim())) {
    return NextResponse.json({ error: "Enter a message first." }, { status: 400 });
  }

  // 1. Prefer FastAPI /chat (uses centralized GPU queue + server Ollama config)
  try {
    const backendRes = await fetch(`${FASTAPI_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      signal: request.signal,
      body: JSON.stringify({
        ...(chat ? { messages } : { prompt }),
        model: model || undefined,
      }),
      cache: "no-store",
    });
    if (backendRes.ok && backendRes.body) {
      return new Response(backendRes.body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    }
    // If backend returned a non-404 error (e.g. 503 Ollama down or 401), surface it
    if (backendRes.status !== 404) {
      const info = await backendRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: info.detail || info.error || "The local model could not answer." },
        { status: backendRes.status }
      );
    }
  } catch (err) {
    if (request.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
      return new Response(null, { status: 499 });
    }
    // Fall through to direct OLLAMA_URL if FastAPI is unreachable or lacks /chat
  }

  // 2. Fallback to direct Ollama endpoint
  try {
    const res = await fetch(`${OLLAMA_URL}/api/${chat ? "chat" : "generate"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: request.signal,
      body: JSON.stringify({
        ...(chat ? { messages } : { prompt }),
        model: model || DEFAULT_MODEL,
        stream: true,
        think: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1,
          num_predict: 1024,
        },
      }),
    });
    if (!res.ok || !res.body) {
      const info = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: info.error || "The local model could not answer." },
        { status: res.ok ? 502 : res.status }
      );
    }
    return new Response(responseText(res.body), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "The local model is unavailable. Reconnect to Ollama and try again." },
      { status: 503 }
    );
  }
}
