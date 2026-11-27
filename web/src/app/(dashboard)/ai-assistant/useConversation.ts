"use client";

import { useEffect, useRef, useState } from "react";
import {
  clearActiveThread,
  readActiveThread,
  saveActiveThread,
  modeLabels,
  type ExternalHandoff,
  type Message,
  type Mode,
  type Thread,
} from "@/lib/conversations";
import { generateId } from "@/lib/storage";
import {
  readJson,
  responseError,
  type AskReply,
  type DocsReply,
  type SqlReply,
} from "@/lib/workspace-client";

type Flight = { controller: AbortController; interrupted: () => Thread };

const CHAT_PERSONAL_OR_ADMIN = [
  "my attendance", "my marks", "my cie", "my usn", "my cgpa",
  "my fee", "fee deadline", "room number", "my room", "my seat", "my timetable",
];
const CHAT_CONCEPTUAL = [
  "explain", "what is", "how does", "how do", "describe", "compare",
  "difference between", "define", "example", "study", "quiz", "learn",
  "understand", "concept", "algorithm", "theory", "syllabus", "revision",
  "notes", "types of", "advantages", "disadvantages", "why",
];
const CHAT_BROAD = [
  "entire syllabus", "all units", "full course", "complete syllabus",
  "all topics", "whole syllabus", "all modules",
];

function classifyChatHandoff(question: string, answer: string): ExternalHandoff | undefined {
  const q = question.toLowerCase();
  if (CHAT_PERSONAL_OR_ADMIN.some((sig) => q.includes(sig))) return undefined;
  if (!CHAT_CONCEPTUAL.some((sig) => q.includes(sig))) return undefined;
  const isBroad = CHAT_BROAD.some((sig) => q.includes(sig));
  const limit = isBroad ? 2500 : 700;
  const context = `Question: ${question}\n\nAnswer Summary: ${answer.slice(0, limit)}`;
  return {
    eligible: true,
    context,
    topic: question.slice(0, 40),
    isBroad,
  };
}

async function syncThreadToBackend(thread: Thread) {
  try {
    await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(thread),
      cache: "no-store",
    });
  } catch {
    /* Local browser persistence remains intact if backend history is offline. */
  }
}

export function useConversation(audience: string, userId: string, initialMode?: Mode) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode ?? "ask");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const flight = useRef<Flight | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = readActiveThread(userId);
      setThread(saved ?? null);
      const lastMode = saved?.messages.at(-1)?.mode;
      const resumedMode =
        lastMode && Object.hasOwn(modeLabels, lastMode) ? lastMode : "chat";
      setMode(initialMode ?? (saved ? resumedMode : "ask"));
      setBusy(false);
      setRestored(true);
    });
    return () => {
      cancelAnimationFrame(frame);
      const active = flight.current;
      if (active) {
        flight.current = null;
        active.controller.abort();
        saveActiveThread(active.interrupted(), userId);
      }
    };
  }, [initialMode, userId]);

  function newThread() {
    if (flight.current) return;
    clearActiveThread(userId);
    setSaveError(false);
    setThread(null);
  }

  async function send(text: string, model: string) {
    const prompt = text.trim();
    if (!prompt || !restored || flight.current) return;
    const now = new Date().toISOString();
    const turn: Message = { role: "user", content: prompt, mode, timestamp: now };
    const history = [...(thread?.messages ?? []), turn];
    let reply: Message = { role: "assistant", content: "", timestamp: now, mode };
    const base = {
      id: thread?.id ?? generateId(),
      title: thread?.title ?? prompt.slice(0, 60),
      model: model || "Service default",
      createdAt: thread?.createdAt ?? now,
    };
    const snapshot = (message: Message): Thread => ({
      ...base,
      updatedAt: new Date().toISOString(),
      messages: [...history, message],
    });
    const controller = new AbortController();
    const run = {
      controller,
      interrupted: () => snapshot({ ...reply, status: "stopped" }),
    };
    flight.current = run;
    function publish() {
      if (flight.current === run) setThread(snapshot(reply));
    }
    function store(value: Thread) {
      setSaveError(!saveActiveThread(value, userId));
    }
    setBusy(true);
    publish();
    store(run.interrupted());
    const post = (body: object): RequestInit => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // Per-chat context: only prior successful turns from the current thread (empty on New chat).
    // Put [SQL: ...] first so follow-up SQL generation always sees the exact table & WHERE filter.
    const priorTurns = (thread?.messages ?? [])
      .filter(
        (m) =>
          !m.status &&
          m.content.trim() &&
          !m.content.startsWith("I could not find this in the available")
      )
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.sqlMeta?.sql
          ? `[SQL: ${m.sqlMeta.sql}]\n${m.content.slice(0, 300)}`
          : m.content.slice(0, 400),
      }));

    try {
      if (mode === "chat") {
        const turns = history
          .filter((m) => (m.mode ?? "chat") === "chat" && !m.status && m.content)
          .map(({ role, content }) => ({ role, content }));
        const res = await fetch(
          "/api/chat",
          post({ prompt, model: model || undefined, messages: turns })
        );
        if (!res.ok)
          throw new Error(
            await responseError(res, "The local model could not answer.")
          );
        if (!res.body)
          throw new Error("The local model returned an empty response.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            const token = done
              ? decoder.decode()
              : decoder.decode(value, { stream: true });
            reply = { ...reply, content: reply.content + token };
            if (done) break;
            publish();
          }
        } finally {
          reader.releaseLock();
        }
        if (!reply.content.trim())
          throw new Error("The local model returned an empty response.");
        reply = {
          ...reply,
          externalHandoff: classifyChatHandoff(prompt, reply.content),
        };
      } else if (mode === "data") {
        const data = await readJson<SqlReply>(
          "/api/ask-sql",
          post({ prompt, model: model || undefined, history: priorTurns })
        );
        const rows = data.result ?? [];
        const columns = data.columns ?? Object.keys(rows[0] ?? {});
        const count = data.row_count ?? rows.length;
        const singleValue = count === 1 && columns.length === 1 && rows[0];
        const summary = singleValue
          ? `${columns[0]}: ${rows[0][columns[0]] ?? "—"}`
          : `${count.toLocaleString()} ${count === 1 ? "row" : "rows"} returned.`;
        reply = {
          ...reply,
          result: rows,
          sqlMeta: {
            sql: data.sql ?? data.generated_sql,
            row_count: count,
            columns,
          },
          status: data.error ? "error" : undefined,
          content: data.error || (count ? summary : "No matching rows."),
        };
      } else if (mode === "ask") {
        const data = await readJson<AskReply>(
          "/api/ask",
          post({ question: prompt, role: audience, model: model || undefined, history: priorTurns })
        );
        const rows = data.sql_result ?? [];
        const hasSql =
          !!data.sql_query ||
          !!data.sql_error ||
          data.sql_row_count != null ||
          rows.length > 0;
        reply = {
          ...reply,
          route: data.route,
          timeTakenMs: data.time_taken_ms,
          docSources: data.doc_sources,
          content:
            data.answer ||
            data.error ||
            (data.sql_error
              ? "The records query could not be completed."
              : rows.length
              ? "The matching records are shown below."
              : "No matching campus information was found."),
          status: data.error ? "error" : undefined,
          result: hasSql ? rows : undefined,
          sqlMeta: hasSql
            ? {
                sql: data.sql_query,
                columns: data.sql_columns?.length
                  ? data.sql_columns
                  : Object.keys(rows[0] ?? {}),
                row_count: data.sql_row_count ?? rows.length,
                error: data.sql_error,
              }
            : undefined,
          externalHandoff: data.external_handoff?.eligible
            ? {
                eligible: true,
                context: data.external_handoff.context,
                topic: data.external_handoff.topic,
                isBroad: data.external_handoff.is_broad,
              }
            : undefined,
        };
      } else {
        const data = await readJson<DocsReply>(
          "/api/ask-docs",
          post({ question: prompt, role: audience, model: model || undefined, history: priorTurns })
        );
        reply = {
          ...reply,
          content: data.answer || "No matching passage was found.",
          docSources: data.sources ?? [],
          timeTakenMs: data.time_taken_ms,
          externalHandoff: data.external_handoff?.eligible
            ? {
                eligible: true,
                context: data.external_handoff.context,
                topic: data.external_handoff.topic,
                isBroad: data.external_handoff.is_broad,
              }
            : undefined,
        };
      }
    } catch (error) {
      if (controller.signal.aborted) reply = { ...reply, status: "stopped" };
      else
        reply = {
          ...reply,
          status: "error",
          content: [
            reply.content,
            error instanceof Error && !(error instanceof TypeError)
              ? error.message
              : "Connection interrupted. Check the local service and try again.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        };
    } finally {
      if (flight.current === run) {
        const done = controller.signal.aborted
          ? run.interrupted()
          : snapshot(reply);
        setThread(done);
        store(done);
        void syncThreadToBackend(done);
        flight.current = null;
        setBusy(false);
      }
    }
  }

  return {
    thread,
    mode,
    setMode,
    busy,
    restored,
    saveError,
    newThread,
    send,
    stop: () => flight.current?.controller.abort(),
  };
}
