import { NextResponse } from "next/server";
import { FASTAPI_URL, OLLAMA_URL } from "@/lib/campus-api";

export async function GET() {
  const sources = [`${FASTAPI_URL}/models`, `${OLLAMA_URL}/api/tags`];
  for (const url of sources) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data.models)) continue;
      const models = data.models.flatMap((entry: unknown) => {
        if (typeof entry === "string" && entry.trim()) return [{ name: entry }];
        if (
          entry &&
          typeof entry === "object" &&
          "name" in entry &&
          typeof entry.name === "string" &&
          entry.name.trim()
        ) {
          return [entry];
        }
        return [];
      });
      if (!data.models.length || models.length) return NextResponse.json({ models });
    } catch {
      /* Try the other local model catalog. */
    }
  }
  return NextResponse.json(
    { error: "The local model service is unavailable." },
    { status: 503 }
  );
}
