import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { SESSION_COOKIE } from "@/lib/campus-api";

export async function GET() {
  const session = await currentSession();
  if (!session) {
    const res = NextResponse.json({ detail: "Session expired or invalid." }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  return NextResponse.json({ user: session.user });
}
