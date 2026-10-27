import { NextRequest, NextResponse } from "next/server";

const FASTAPI = "http://127.0.0.1:8000";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const { table } = await params;
  const res = await fetch(`${FASTAPI}/tables/${encodeURIComponent(table)}`, {
    method: "DELETE",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
