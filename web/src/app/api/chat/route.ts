import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { prompt, model } = await request.json();

  const ollamaRes = await fetch("http://127.0.0.1:11435/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "qwen3:4b",
      prompt: prompt,
      stream: true,
      think: false,
      options: {
        temperature: 0.7,     // Balanced creativity vs speed
        top_p: 0.9,           // Faster sampling
        top_k: 40,            // Limit token candidates for speed
        repeat_penalty: 1.1,  // Avoid repetitive loops
        num_predict: 1024,    // Cap max tokens - prevents runaway responses
      }
    }),
  });

  if (!ollamaRes.ok || !ollamaRes.body) {
    const err = await ollamaRes.text();
    return new Response(JSON.stringify({ error: err }), { status: 500 });
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
          // Each line from Ollama is a JSON object like: {"response":"word","done":false}
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
      "X-Accel-Buffering": "no", // Disable nginx buffering if behind a proxy
    },
  });
}
