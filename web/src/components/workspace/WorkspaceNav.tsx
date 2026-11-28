"use client";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { clearActiveThread } from "@/lib/conversations";
import Icon from "./Icon";
import styles from "./workspace.module.css";

export default function WorkspaceNav({
  role,
  userName,
  userId,
  open,
  onToggle,
  onCloseMobile,
}: {
  role: string;
  userName?: string;
  userId?: string;
  open: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}) {
  async function leave() {
    clearActiveThread(userId);
    clearActiveThread();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* Proceed to login even if logout request failed. */
    }
    window.location.replace("/login");
  }
  return (
    <aside className={styles.rail} aria-hidden={!open || undefined}>
      <div className={styles.railTop}>
        <Header />
        <button
          type="button"
          className={styles.railClose}
          aria-label="Hide navigation menu"
          aria-expanded={open}
          title="Hide menu"
          onClick={onToggle}
        >
          <Icon name="sidebar" size={18} />
        </button>
      </div>
      <Sidebar onNavigate={onCloseMobile} />
      <div className={styles.railPhoto} aria-hidden="true" />
      <div className={styles.railFooter}>
        <div>
          <span className={styles.session}>
            {userName ? `${userName} · ` : ""}
            {role === "hod" ? "HOD" : role}
          </span>
          <small>RV College of Engineering</small>
        </div>
        <button type="button" onClick={() => void leave()} className={styles.exit} aria-label="Sign out" title="Sign out">
          <Icon name="exit" size={18} />
        </button>
      </div>
    </aside>
  );
}
