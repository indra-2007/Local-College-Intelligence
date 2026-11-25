import { NextRequest, NextResponse } from "next/server";

const FASTAPI = "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${FASTAPI}/ask-docs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend unreachable. Is FastAPI running on port 8000?", answer: "Backend unreachable." },
      { status: 503 }
    );
  }
}
