import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import WorkspaceNav from "@/components/workspace/WorkspaceNav";
import { currentSession } from "@/lib/current-session";
import styles from "@/components/workspace/workspace.module.css";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/login?expired=1");

  return (
    <div className={styles.workspace}>
      <a href="#work-area" className={styles.skipLink}>Skip to workspace</a>
      <WorkspaceNav role={session.user.role} userName={session.user.name} userId={session.user.id} />
      <main id="work-area" className={styles.main} tabIndex={-1}>{children}</main>
    </div>
  );
}
