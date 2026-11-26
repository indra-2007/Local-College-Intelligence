import { NextResponse } from "next/server";
import { campusRequest, ROLE_RANK } from "@/lib/campus-api";
import { currentSession } from "@/lib/current-session";

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      { detail: "Session expired or not signed in. Please sign in again." },
      { status: 401 }
    );
  }

  let body: { question?: string; role?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload." }, { status: 400 });
  }

  const requestedRole = (body.role ?? session.user.role).trim().toLowerCase();
  const userRank = ROLE_RANK[session.user.role] ?? 0;
  const reqRank = ROLE_RANK[requestedRole];
  if (reqRank === undefined) {
    return NextResponse.json({ detail: `Invalid audience '${requestedRole}'.` }, { status: 400 });
  }
  if (reqRank > userRank) {
    return NextResponse.json(
      { detail: `Forbidden: '${session.user.role}' cannot query '${requestedRole}' audience.` },
      { status: 403 }
    );
  }

  return campusRequest(
    "/ask",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, role: requestedRole }),
      signal: request.signal,
    },
    { requireAuth: true }
  );
}
