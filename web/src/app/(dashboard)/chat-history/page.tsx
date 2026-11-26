import type { Metadata } from "next";
import { currentSession } from "@/lib/current-session";
import History from "./History";

export const metadata: Metadata = { title: "Chat history" };

export default async function ChatHistoryPage() {
  const session = await currentSession();
  return <History userId={session?.user.id ?? "anon"} />;
}
