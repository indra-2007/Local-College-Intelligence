"use client";

import { useState, type ReactNode } from "react";
import WorkspaceNav from "@/components/workspace/WorkspaceNav";
import Icon from "@/components/workspace/Icon";
import styles from "@/components/workspace/workspace.module.css";

export default function WorkspaceShell({
  role,
  userName,
  userId,
  children,
}: {
  role: string;
  userName?: string;
  userId?: string;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={styles.workspace} data-nav={navOpen ? "open" : "closed"}>
      <a href="#work-area" className={styles.skipLink}>Skip to workspace</a>
      {navOpen && (
        <button
          type="button"
          className={styles.navBackdrop}
          aria-label="Close navigation menu"
          onClick={() => setNavOpen(false)}
        />
      )}
      <WorkspaceNav
        role={role}
        userName={userName}
        userId={userId}
        open={navOpen}
        onToggle={() => setNavOpen(v => !v)}
        onCloseMobile={() => {
          if (window.matchMedia("(max-width: 800px)").matches) setNavOpen(false);
        }}
      />
      <main id="work-area" className={styles.main} tabIndex={-1}>
        {!navOpen && (
          <button
            type="button"
            className={styles.navToggle}
            aria-label="Open navigation menu"
            aria-expanded={false}
            title="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <Icon name="sidebar" size={18} />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
