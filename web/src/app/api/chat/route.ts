import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { prompt, model } = await request.json();

    const ollamaRes = await fetch("http://127.0.0.1:11435/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "qwen2.5-coder:7b",
        prompt: prompt,
        stream: true,
        think: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1,
          num_predict: 1024,
        }
      }),
    });

    if (!ollamaRes.ok || !ollamaRes.body) {
      const err = await ollamaRes.text().catch(() => "Ollama unreachable");
      return new Response(JSON.stringify({ error: err }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream Ollama's NDJSON response → client as plain text chunks
    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body!.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(Boolean);
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  controller.enqueue(new TextEncoder().encode(json.response));
                }
                if (json.done) {
                  controller.close();
                  return;
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response("Could not reach LLM. Check that Ollama is running and SSH tunnel is active.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
