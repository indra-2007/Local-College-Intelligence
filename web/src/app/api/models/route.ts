import { NextResponse } from "next/server";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const res = await fetch("http://127.0.0.1:11435/api/tags", { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ models: data.models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
