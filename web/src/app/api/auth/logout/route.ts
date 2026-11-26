import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FASTAPI_URL, SESSION_COOKIE } from "@/lib/campus-api";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await fetch(`${FASTAPI_URL}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Clear local cookie even if backend is offline.
    }
  }
  const response = NextResponse.json({ status: "ok" });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete("auth-session");
  return response;
}
