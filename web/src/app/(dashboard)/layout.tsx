import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { currentSession } from "@/lib/current-session";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/login?expired=1");

  return (
    <WorkspaceShell role={session.user.role} userName={session.user.name} userId={session.user.id}>
      {children}
    </WorkspaceShell>
  );
}
