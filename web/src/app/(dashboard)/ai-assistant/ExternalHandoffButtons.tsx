"use client";

import { type CSSProperties, useEffect, useState } from "react";
import type { ExternalHandoff } from "@/lib/conversations";
import styles from "./chat.module.css";

const URL_PREFILL_LIMIT = 6000;

const PLATFORMS = [
  {
    id: "chatgpt" as const,
    label: "ChatGPT",
    url: "https://chatgpt.com/",
    supportsQueryParam: true,
    color: "#10A37F",
  },
  {
    id: "gemini" as const,
    label: "Gemini",
    url: "https://gemini.google.com/app",
    supportsQueryParam: false,
    color: "#4285F4",
  },
  {
    id: "claude" as const,
    label: "Claude",
    url: "https://claude.ai/new",
    supportsQueryParam: true,
    color: "#D97706",
  },
] as const;

type Platform = (typeof PLATFORMS)[number];

function buildPrompt(handoff: ExternalHandoff, role: string): string {
  const prefix =
    role === "student"
      ? "I'm an engineering student at RVCE, Bengaluru. Help me explore and understand the following clearly with examples and exam-relevant insights:"
      : role === "faculty"
      ? "I'm a faculty member at RVCE, Bengaluru. Help me develop lecture or research material on the following:"
      : role === "hod"
      ? "As the Head of Department at RVCE, Bengaluru, provide curriculum-level analysis on the following:"
      : "As an administrator at RVCE, Bengaluru, help me analyze the following:";
  return `${prefix}\n\n${handoff.context}`;
}

async function copyTextReliably(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
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
    const id = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!handoff.eligible) return null;

  async function handleClick(platform: Platform) {
    const prompt = buildPrompt(handoff, role);
    if (platform.supportsQueryParam) {
      const encoded = encodeURIComponent(prompt);
      if (encoded.length <= URL_PREFILL_LIMIT) {
        window.open(`${platform.url}?q=${encoded}`, "_blank", "noopener,noreferrer");
        return;
      }
      const copied = await copyTextReliably(prompt);
      setToast(
        copied
          ? `Prompt copied — paste in ${platform.label}`
          : "Could not copy — please copy manually"
      );
      window.open(platform.url, "_blank", "noopener,noreferrer");
      return;
    }

    // Gemini web app does not prefill via URL query parameters; copy before opening tab
    const copied = await copyTextReliably(prompt);
    setToast(
      copied
        ? `Prompt copied — paste (Ctrl+V) in ${platform.label}`
        : "Could not copy — please copy manually"
    );
    window.open(platform.url, "_blank", "noopener,noreferrer");
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
