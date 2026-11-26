import { campusRequest } from "@/lib/campus-api";

export async function GET(request: Request) {
  return campusRequest("/tables", { signal: request.signal }, { requireAuth: true });
}
