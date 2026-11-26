import { campusRequest } from "@/lib/campus-api";

export async function GET(request: Request) {
  return campusRequest("/chats", { signal: request.signal }, { requireAuth: true });
}

export async function POST(request: Request) {
  return campusRequest(
    "/chats",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      signal: request.signal,
    },
    { requireAuth: true }
  );
}
