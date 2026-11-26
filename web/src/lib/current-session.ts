import { cookies } from "next/headers";
import { FASTAPI_URL, SESSION_COOKIE } from "./campus-api";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "faculty" | "hod" | "admin";
  department: string;
}

export interface VerifiedSession {
  user: SessionUser;
  token: string;
}

export async function currentSession(): Promise<VerifiedSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${FASTAPI_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SessionUser };
    if (!data?.user?.id || !data.user.role) return null;
    return { user: data.user, token };
  } catch {
    return null;
  }
}

export async function currentRole(): Promise<SessionUser["role"]> {
  const session = await currentSession();
  const role = session?.user.role;
  return role === "admin" || role === "hod" || role === "faculty" ? role : "student";
}
