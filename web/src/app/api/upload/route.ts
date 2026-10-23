import { NextRequest, NextResponse } from "next/server";

const FASTAPI = "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const res = await fetch(`${FASTAPI}/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
