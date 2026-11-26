import type { Metadata } from "next";
import { permittedAudiences } from "@/lib/campus-api";
import { currentSession } from "@/lib/current-session";
import ChatDesk from "./ChatDesk";

export const metadata: Metadata = { title: "AI chat" };

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const [{ mode }, session] = await Promise.all([searchParams, currentSession()]);
  const role = session?.user.role ?? "student";
  const userId = session?.user.id ?? "anon";
  const audiences = permittedAudiences(role);
  const initialMode =
    mode === "sql" || mode === "data"
      ? "data"
      : mode === "ask" || mode === "docs" || mode === "chat"
      ? mode
      : undefined;
  return (
    <ChatDesk
      role={role}
      userId={userId}
      audiences={audiences}
      initialMode={initialMode}
    />
  );
}
