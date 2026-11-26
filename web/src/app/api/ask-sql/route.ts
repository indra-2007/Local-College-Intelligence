import { campusRequest } from "@/lib/campus-api";

export async function POST(request: Request) {
  return campusRequest(
    "/ask-sql",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      signal: request.signal,
    },
    { requireAuth: true }
  );
}
