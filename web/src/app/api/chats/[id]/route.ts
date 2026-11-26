import { campusRequest } from "@/lib/campus-api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return campusRequest(
    `/chats/${encodeURIComponent(id)}`,
    { signal: request.signal },
    { requireAuth: true }
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return campusRequest(
    `/chats/${encodeURIComponent(id)}`,
    { method: "DELETE", signal: request.signal },
    { requireAuth: true }
  );
}
