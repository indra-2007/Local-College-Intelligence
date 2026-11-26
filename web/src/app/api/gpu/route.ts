import { campusRequest } from "@/lib/campus-api";

export async function GET(request: Request) {
  return campusRequest("/gpu", { signal: AbortSignal.any([request.signal, AbortSignal.timeout(4500)]) });
}
