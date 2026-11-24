import { NextResponse } from "next/server";

const FASTAPI = "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI}/gpu`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { available: false, error: "Backend unreachable" },
      { status: 503 }
    );
  }
}
