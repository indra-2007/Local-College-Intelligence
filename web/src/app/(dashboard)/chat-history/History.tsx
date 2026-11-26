"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TitleLetters from "@/components/TitleLetters";
import Icon from "@/components/workspace/Icon";
import shared from "@/components/workspace/workspace.module.css";
import {
  getChatSessions,
  deleteChatSession,
  upsertChatSession,
  getLegacyChatSessions,
  removeLegacyChatSession,
  type ChatSession,
} from "@/lib/storage";
import {
  selectActiveThread,
  readActiveThread,
  clearActiveThread,
  modeLabels,
  type Thread,
} from "@/lib/conversations";
import { readJson } from "@/lib/workspace-client";
import Transcript from "../ai-assistant/Transcript";
import styles from "./history.module.css";

function sortThreads(items: Thread[]): Thread[] {
  return [...items].sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  );
}

function mergeThreads(remote: Thread[], local: Thread[]): Thread[] {
  const byId = new Map<string, Thread>();
  for (const t of local) byId.set(t.id, t);
  for (const t of remote) byId.set(t.id, t);
  return sortThreads([...byId.values()]);
}

function lastUpdated(timestamp: string) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(time).toLocaleDateString();
}

export default function History({ userId }: { userId: string }) {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [legacy, setLegacy] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadHistory = useCallback(async () => {
    const local = getChatSessions(userId) as Thread[];
    setLegacy(getLegacyChatSessions());
    try {
      const remote = await readJson<Thread[]>("/api/chats");
      if (Array.isArray(remote)) {
        const merged = mergeThreads(remote, local);
        for (const t of remote) upsertChatSession(t, userId);
        setThreads(merged);
        return;
      }
    } catch {
      /* Fall back to browser-scoped history if backend is unavailable. */
    }
    setThreads(sortThreads(local));
  }, [userId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadHistory());
    const onStorage = () => {
      setThreads(sortThreads(getChatSessions(userId) as Thread[]));
      setLegacy(getLegacyChatSessions());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("storage", onStorage);
    };
  }, [loadHistory, userId]);

  function resume(id: string) {
    try {
      if (selectActiveThread(id, userId, threads ?? undefined)) {
        router.push("/ai-assistant");
        return;
      }
      setNotice("This conversation is no longer available.");
    } catch {
      setNotice("Allow browser storage to resume this conversation.");
    }
  }

  function startNew() {
    clearActiveThread(userId);
    router.push("/ai-assistant");
  }

  async function remove(id: string) {
    try {
      const active = readActiveThread(userId)?.id === id;
      await fetch(`/api/chats/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
        () => null
      );
      deleteChatSession(id, userId);
      if (active) clearActiveThread(userId);
      if (preview === id) setPreview(null);
      setThreads((prev) => (prev ? prev.filter((t) => t.id !== id) : []));
      setConfirm(null);
      setNotice("Conversation deleted.");
    } catch {
      setNotice("Could not delete this conversation. Try again.");
    }
  }

  async function recoverLegacy(item: ChatSession) {
    const thread = item as Thread;
    upsertChatSession(thread, userId);
    removeLegacyChatSession(item.id);
    await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(thread),
    }).catch(() => null);
    setLegacy(getLegacyChatSessions());
    setThreads((prev) => mergeThreads([thread], prev ?? []));
    setNotice(`Recovered "${item.title || "Untitled chat"}" into your account.`);
  }

  const query = search.trim().toLowerCase();
  const matches = threads?.filter(
    (t) =>
      t.title.toLowerCase().includes(query) ||
      t.messages.some((m) => m.content.toLowerCase().includes(query))
  );
  const total =
    threads?.reduce((count, thread) => count + thread.messages.length, 0) ?? 0;

  return (
    <section className={styles.scroll} aria-labelledby="history-heading">
      <div className={shared.page}>
        <header className={shared.pageHead}>
          <h1 id="history-heading" aria-label="Chat history">
            <TitleLetters text="Chat history" />
          </h1>
          <button className={shared.ghost} onClick={startNew}>
            <Icon name="plus" size={16} />New chat
          </button>
        </header>
        <div className={styles.historyHead}>
          <p className={styles.intro}>Conversations saved for your account.</p>
          {threads && threads.length > 0 && (
            <small>
              {threads.length}{" "}
              {threads.length === 1 ? "conversation" : "conversations"} ·{" "}
              {total} {total === 1 ? "message" : "messages"}
            </small>
          )}
        </div>
        {!!threads?.length && (
          <div className={styles.search}>
            <label htmlFor="history-search">Search conversations</label>
            <div>
              <input
                id="history-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search titles or messages"
              />
              {search && (
                <button
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </div>
          </div>
        )}
        <p role="status" className={shared.hint}>
          {notice}
        </p>
        {!threads ? (
          <p>Reading history…</p>
        ) : !threads.length ? (
          <p>
            No conversations yet. Start a chat to save your first exchange.
          </p>
        ) : !matches?.length ? (
          <p>No conversations match your search.</p>
        ) : (
          <ul className={styles.list}>
            {matches.map((t) => {
              const title = t.title || "Untitled chat";
              const last = t.messages.at(-1);
              const count = t.messages.filter((m) => m.role === "user").length;
              const age = lastUpdated(t.updatedAt);
              const open = preview === t.id;
              const panel = `history-preview-${t.id}`;
              return (
                <li key={t.id}>
                  <div className={styles.row}>
                    <button
                      className={styles.thread}
                      aria-label={`Preview ${title}`}
                      aria-expanded={open}
                      aria-controls={panel}
                      onClick={() => setPreview(open ? null : t.id)}
                    >
                      <span className={styles.threadTitle}>
                        <Icon name="chevron" size={14} />
                        <strong>{title}</strong>
                      </span>
                      {last?.content && (
                        <span className={styles.excerpt}>{last.content}</span>
                      )}
                      <small>
                        {modeLabels[last?.mode ?? "chat"] || "Chat"}
                        {t.model && ` · ${t.model}`} · {count}{" "}
                        {count === 1 ? "question" : "questions"}
                        {age && ` · ${age}`}
                      </small>
                    </button>
                    <button
                      className={shared.ghost}
                      aria-label={`Continue ${title}`}
                      onClick={() => resume(t.id)}
                    >
                      Continue
                    </button>
                    <button
                      className={shared.ghost}
                      aria-label={`Delete ${title}`}
                      onClick={() => setConfirm(t.id)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                  <div id={panel} className={styles.preview} hidden={!open}>
                    {open &&
                      (t.messages.length ? (
                        <Transcript messages={t.messages} busy={false} showTimes />
                      ) : (
                        <p>No messages in this conversation.</p>
                      ))}
                  </div>
                  {confirm === t.id && (
                    <div
                      className={styles.confirm}
                      role="group"
                      aria-label={`Delete ${title}?`}
                    >
                      Delete this conversation?
                      <button
                        className={shared.ghost}
                        onClick={() => setConfirm(null)}
                      >
                        Keep
                      </button>
                      <button
                        className={shared.ghost}
                        onClick={() => void remove(t.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {legacy.length > 0 && (
          <div className={styles.historyHead} style={{ marginTop: "1.5rem" }}>
            <p className={styles.intro}>
              Legacy browser chats ({legacy.length} unassigned)
            </p>
            <ul className={styles.list}>
              {legacy.map((item) => (
                <li key={item.id}>
                  <div className={styles.row}>
                    <span className={styles.threadTitle}>
                      <strong>{item.title || "Untitled chat"}</strong>
                    </span>
                    <button
                      className={shared.ghost}
                      onClick={() => void recoverLegacy(item)}
                    >
                      Recover to account
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
