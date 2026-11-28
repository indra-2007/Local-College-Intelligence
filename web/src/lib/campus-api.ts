// Server-only configuration and FastAPI/Ollama proxy helpers.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const FASTAPI_URL =
  process.env.FASTAPI_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
export const OLLAMA_URL =
  process.env.OLLAMA_URL ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL ?? "qwen2.5-coder:7b";
export const SESSION_COOKIE = "cgpt_token";

export const ROLE_RANK: Record<string, number> = {
  student: 0,
  faculty: 1,
  hod: 2,
  admin: 3,
};

export function permittedAudiences(role: string): string[] {
  const rank = ROLE_RANK[role] ?? 0;
  return Object.entries(ROLE_RANK)
    .filter(([, r]) => r <= rank)
    .map(([name]) => name);
}

export async function campusRequest(
  path: string,
  init?: RequestInit,
  options?: { requireAuth?: boolean }
) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (options?.requireAuth && !token) {
    return NextResponse.json(
      { detail: "Session expired or not signed in. Please sign in again." },
      { status: 401 }
    );
  }

  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const res = await fetch(`${FASTAPI_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const text = await res.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { detail: text };
      }
    }
    const response = NextResponse.json(body, { status: res.status });
    if (res.status === 401) {
      response.cookies.delete(SESSION_COOKIE);
      response.cookies.delete("auth-session");
    }
    return response;
  } catch {
    return NextResponse.json(
      {
        detail:
          "The campus data service is unavailable. Check the local FastAPI connection and try again.",
      },
      { status: 503 }
    );
  }
}
