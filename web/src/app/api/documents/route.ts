import { campusRequest } from "@/lib/campus-api";

export async function GET(request: Request) {
  return campusRequest("/documents", { signal: request.signal }, { requireAuth: true });
}
