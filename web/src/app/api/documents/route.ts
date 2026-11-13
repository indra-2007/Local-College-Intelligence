import { NextResponse } from "next/server";

const FASTAPI = "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI}/documents`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ documents: [] }, { status: 500 });
  }
}

