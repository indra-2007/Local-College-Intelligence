"use client";

import { type CSSProperties, useEffect, useState } from "react";
import type { ExternalHandoff } from "@/lib/conversations";
import styles from "./chat.module.css";

const CHATGPT_URL_LIMIT = 2000;

const PLATFORMS = [
  {
    id: "chatgpt" as const,
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    color: "#10A37F",
  },
  {
    id: "gemini" as const,
    label: "Gemini",
    url: "https://gemini.google.com/app",
    color: "#4285F4",
  },
  {
    id: "claude" as const,
    label: "Claude",
    url: "https://claude.ai/new",
    color: "#D97706",
  },
] as const;

type Platform = (typeof PLATFORMS)[number];

function buildPrompt(handoff: ExternalHandoff, role: string): string {
  const prefix =
    role === "student"
      ? "I'm an engineering student at RVCE, Bengaluru. Help me understand the following concept from an exam and study perspective:"
      : role === "faculty"
      ? "I'm a faculty member at RVCE, Bengaluru. Help me develop lecture or research content on the following:"
      : role === "hod"
      ? "As the Head of Department at RVCE, Bengaluru, provide curriculum-level analysis on the following:"
      : "As an administrator at RVCE, Bengaluru, help me understand the following:";
  return `${prefix}\n\n${handoff.context}`;
}

export default function ExternalHandoffButtons({
  handoff,
  role,
}: {
  handoff: ExternalHandoff;
  role: string;
}) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!handoff.eligible) return null;

  async function handleClick(platform: Platform) {
    const prompt = buildPrompt(handoff, role);
    if (platform.id === "chatgpt") {
      const encoded = encodeURIComponent(prompt);
      if (encoded.length <= CHATGPT_URL_LIMIT) {
        window.open(`${platform.url}?q=${encoded}`, "_blank", "noopener,noreferrer");
      } else {
        try {
          await navigator.clipboard.writeText(prompt);
          setToast("Prompt copied — paste in ChatGPT");
        } catch {
          setToast("Could not copy — please copy manually");
        }
        window.open(platform.url, "_blank", "noopener,noreferrer");
      }
    } else {
      try {
        await navigator.clipboard.writeText(prompt);
        setToast(`Prompt copied — paste in ${platform.label}`);
      } catch {
        setToast("Could not copy — please copy manually");
      }
      window.open(platform.url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className={styles.handoffBar}>
      <span className={styles.handoffLabel}>Explore deeper with:</span>
      {PLATFORMS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={styles.handoffBtn}
          style={{ "--handoff-accent": p.color } as CSSProperties}
          onClick={() => void handleClick(p)}
          aria-label={`Open in ${p.label}`}
        >
          {p.label}
        </button>
      ))}
      {toast && (
        <div className={styles.handoffToast} role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
