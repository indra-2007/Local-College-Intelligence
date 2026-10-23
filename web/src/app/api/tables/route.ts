import { NextResponse } from "next/server";

const FASTAPI = "http://127.0.0.1:8000";

export async function GET() {
  const res = await fetch(`${FASTAPI}/tables`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
