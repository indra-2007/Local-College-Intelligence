import { NextResponse } from "next/server";
import { FASTAPI_URL, SESSION_COOKIE } from "@/lib/campus-api";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${FASTAPI_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token || !data?.user) {
      return NextResponse.json(
        { detail: data?.detail || "Invalid email or password." },
        { status: res.ok ? 502 : res.status }
      );
    }

    const response = NextResponse.json({ user: data.user });
    response.cookies.set(SESSION_COOKIE, data.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete("auth-session");
    return response;
  } catch {
    return NextResponse.json(
      { detail: "Authentication service is unavailable. Check the local FastAPI connection." },
      { status: 503 }
    );
  }
}
