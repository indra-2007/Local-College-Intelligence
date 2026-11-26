import { NextResponse } from "next/server";
import { campusRequest } from "@/lib/campus-api";
import { currentSession } from "@/lib/current-session";

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json(
      { detail: "Session expired or not signed in. Please sign in again." },
      { status: 401 }
    );
  }
  if (session.user.role === "student") {
    return NextResponse.json(
      { detail: "Forbidden: students cannot upload or replace campus datasets." },
      { status: 403 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ detail: "Choose a file to upload." }, { status: 400 });
  }

  return campusRequest(
    "/upload",
    { method: "POST", body: form, signal: request.signal },
    { requireAuth: true }
  );
}
