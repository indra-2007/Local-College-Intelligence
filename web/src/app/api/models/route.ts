import { NextResponse } from "next/server";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("http://127.0.0.1:11435/api/tags", { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ models: data.models });
  } catch {
    // Also try the FastAPI /models endpoint as fallback
    try {
      const res2 = await fetch("http://127.0.0.1:8000/models", { signal: AbortSignal.timeout(5000) });
      if (res2.ok) {
        const data2 = await res2.json();
        return NextResponse.json({ models: data2.models?.map((m: string) => ({ name: m })) ?? [] });
      }
    } catch {
      // both failed
    }
    return NextResponse.json({ error: "Cannot reach Ollama or FastAPI. Check SSH tunnel." }, { status: 503 });
  }
}
