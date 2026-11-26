"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./workspace/Icon";
import styles from "./workspace/workspace.module.css";

const links = [
  { href: "/ai-assistant", label: "AI chat", icon: "chat" },
  { href: "/upload", label: "Upload documents", icon: "archive" },
  { href: "/chat-history", label: "Chat history", icon: "clock" },
] as const;

export default function Sidebar() {
  const path = usePathname();
  return <nav className={styles.nav} aria-label="Workspace">
    {links.map(link => <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>
      <Icon name={link.icon} />{link.label}
    </Link>)}
  </nav>;
}
