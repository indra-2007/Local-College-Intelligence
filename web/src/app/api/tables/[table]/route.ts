import { NextResponse } from "next/server";
import { campusRequest } from "@/lib/campus-api";
import { currentSession } from "@/lib/current-session";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      { detail: "Session expired or not signed in. Please sign in again." },
      { status: 401 }
    );
  }
  if (session.user.role === "student") {
    return NextResponse.json(
      { detail: "Forbidden: students cannot delete campus tables." },
      { status: 403 }
    );
  }

  const { table } = await params;
  return campusRequest(
    `/tables/${encodeURIComponent(table)}`,
    { method: "DELETE", signal: request.signal },
    { requireAuth: true }
  );
}
