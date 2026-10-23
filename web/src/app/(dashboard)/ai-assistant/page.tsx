"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  upsertChatSession,
  ChatSession,
  generateId,
} from "@/lib/storage";

type Mode = "chat" | "data";

interface SqlMeta {
  sql?: string;
  row_count?: number;
  columns?: string[];
  error?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode: Mode;
  sqlMeta?: SqlMeta;
  result?: Record<string, unknown>[];
}

export default function AIAssistantPage() {
  const [sessionId] = useState<string>(() => generateId());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [tableCount, setTableCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchModels = useCallback(() => {
    setModelsError("");
    setAvailableModels([]);
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          const names = data.models.map((m: { name: string }) => m.name);
          setAvailableModels(names);
          setModel(names[0]);
        } else {
          setModelsError(data.error || "No models found");
        }
      })
      .catch(() => setModelsError("SSH tunnel not reachable on 127.0.0.1:11435"));
  }, []);

  const fetchTableCount = useCallback(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((data) => setTableCount(Object.keys(data.tables || {}).length))
      .catch(() => setTableCount(0));
  }, []);

  useEffect(() => { fetchModels(); fetchTableCount(); }, [fetchModels, fetchTableCount]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist session to localStorage whenever messages change
  useEffect(() => {
    if (messages.length === 0 || !model) return;
    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? "…" : "")
      : "Untitled chat";

    const session: ChatSession = {
      id: sessionId,
      title,
      model,
      createdAt: messages[0]?.timestamp ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages,
    };
    upsertChatSession(session);
  }, [messages, sessionId, model]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    if (mode === "chat" && !model) return;

    const userMessage = input.trim();
    const now = new Date().toISOString();
    setInput("");

    const userMsg: Message = { role: "user", content: userMessage, timestamp: now, mode };
    const assistantMsg: Message = { role: "assistant", content: "", timestamp: new Date().toISOString(), mode };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);

    // ── DATA MODE: route through FastAPI ask-sql pipeline ──
    if (mode === "data") {
      try {
        const res = await fetch("/api/ask-sql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userMessage, model: model || "qwen3:4b" }),
        });
        const data = await res.json();

        if (!res.ok) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: data.detail || "Backend error.",
              sqlMeta: { error: data.detail },
            };
            return updated;
          });
          return;
        }

        if (data.error) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: data.error,
              sqlMeta: { sql: data.generated_sql, error: data.error },
            };
            return updated;
          });
          return;
        }

        const rowCount = data.row_count ?? data.result?.length ?? 0;
        const cols: string[] = data.columns ?? [];
        const rows: Record<string, unknown>[] = data.result ?? [];

        let summary = "";
        if (rowCount === 0) {
          summary = "No results found.";
        } else if (rowCount === 1 && cols.length === 1) {
          summary = `${cols[0]}: ${rows[0][cols[0]]}`;
        } else {
          summary = `Found ${rowCount} row${rowCount !== 1 ? "s" : ""} across ${cols.length} column${cols.length !== 1 ? "s" : ""}.`;
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: summary,
            sqlMeta: { sql: data.sql, row_count: rowCount, columns: cols },
            result: rows,
          };
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: "[ERROR]: Could not reach the backend. Is FastAPI running and port 8000 tunnelled?",
          };
          return updated;
        });
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
      return;
    }

    // ── CHAT MODE: stream directly from Ollama ──
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMessage, model }),
        signal: controller.signal,
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
            timestamp: new Date().toISOString(),
          };
          return updated;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: "[ERROR]: Could not reach the LLM. Check SSH tunnel.",
          };
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-space-base py-space-md h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">AI Assistant</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Secure connection to local Ollama node via SSH tunnel.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1 border border-surface-variant">
            <button
              onClick={() => setMode("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === "chat"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              Chat
            </button>
            <button
              onClick={() => { setMode("data"); fetchTableCount(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === "data"
                  ? "bg-secondary text-on-secondary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">table_chart</span>
              Ask Data
              {tableCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${mode === "data" ? "bg-on-secondary/20" : "bg-secondary/20 text-secondary"}`}>
                  {tableCount}
                </span>
              )}
            </button>
          </div>

          {/* Model picker */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">psychology</span>
            {availableModels.length > 0 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-variant text-on-surface font-label-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-container"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : modelsError ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-error font-label-sm max-w-xs truncate">{modelsError}</span>
                <button onClick={fetchModels} className="px-2 py-1 rounded-lg bg-primary-container text-on-primary text-xs font-medium hover:opacity-90 transition-all">
                  Retry
                </button>
              </div>
            ) : (
              <span className="text-sm text-on-surface-variant font-label-sm animate-pulse">Connecting to node...</span>
            )}
          </div>
        </div>
      </div>

      {/* Data mode warning when no tables */}
      {mode === "data" && tableCount === 0 && (
        <div className="mb-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container border border-surface-variant text-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">info</span>
          No tables in SQLite yet. Upload a CSV first via
          <a href="/upload" className="underline font-semibold ml-1">Upload &amp; Documents</a>.
        </div>
      )}

      <div className="flex-1 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-space-lg space-y-space-md">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60 gap-3">
              <span className="material-symbols-outlined text-[48px]">
                {mode === "data" ? "table_chart" : "robot_2"}
              </span>
              <p className="font-body-md text-center max-w-sm">
                {mode === "data"
                  ? `Ask questions about your uploaded data. ${tableCount} table${tableCount !== 1 ? "s" : ""} available.`
                  : model ? `${model} is ready. Ask anything.` : "Waiting for model connection..."}
              </p>
              {mode === "data" && tableCount > 0 && (
                <div className="flex flex-col items-center gap-1 text-xs opacity-80 mt-1">
                  <span className="font-semibold mb-1">Example questions:</span>
                  <span>&quot;How many students attended today?&quot;</span>
                  <span>&quot;List all students with attendance below 75%&quot;</span>
                  <span>&quot;Show the top 5 rows of the attendance table&quot;</span>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} gap-1`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-space-md py-space-sm ${
                    msg.role === "user"
                      ? "bg-primary-container text-on-primary rounded-tr-sm"
                      : msg.mode === "data"
                      ? "bg-secondary/10 border border-secondary/20 text-on-surface rounded-tl-sm"
                      : "bg-surface-container-high text-on-surface rounded-tl-sm"
                  }`}
                >
                  <p className="font-body-md whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                    {isLoading && idx === messages.length - 1 && msg.role === "assistant" && (
                      <span className="inline-block w-0.5 h-4 bg-on-surface ml-0.5 animate-pulse align-middle" />
                    )}
                  </p>
                </div>

                {/* Generated SQL collapsible */}
                {msg.sqlMeta?.sql && (
                  <div className="max-w-[80%] w-full">
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer select-none hover:text-on-surface transition-colors px-1 py-0.5">
                        <span className="material-symbols-outlined text-[14px]">code</span>
                        Generated SQL
                        <span className="material-symbols-outlined text-[14px] group-open:rotate-180 transition-transform">expand_more</span>
                      </summary>
                      <code className="block mt-1 px-3 py-2 bg-surface-container rounded-lg text-xs font-mono text-on-surface border border-surface-variant whitespace-pre-wrap break-all">
                        {msg.sqlMeta.sql}
                      </code>
                    </details>
                  </div>
                )}

                {/* Result table for multi-row results */}
                {msg.result && msg.result.length > 1 && msg.sqlMeta?.columns && (
                  <div className="max-w-[90%] w-full overflow-x-auto rounded-xl border border-surface-variant shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-container-low">
                        <tr>
                          {msg.sqlMeta.columns.map((col) => (
                            <th key={col} className="px-3 py-2 font-label-sm text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-variant">
                        {msg.result.slice(0, 20).map((row, i) => (
                          <tr key={i} className="hover:bg-surface-container-low transition-colors">
                            {(msg.sqlMeta?.columns ?? []).map((col) => (
                              <td key={col} className="px-3 py-2 font-mono text-on-surface whitespace-nowrap">
                                {String(row[col] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {msg.result.length > 20 && (
                          <tr>
                            <td colSpan={msg.sqlMeta?.columns?.length ?? 1} className="px-3 py-2 text-center text-on-surface-variant italic">
                              …{msg.result.length - 20} more rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-space-md border-t border-surface-variant bg-surface-container-lowest">
          {mode === "data" && (
            <p className="text-xs text-on-surface-variant mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-secondary">table_chart</span>
              Data mode — LLM generates SQL, Python runs it on your institutional.db
            </p>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || (mode === "chat" && !model)}
              className="flex-1 pl-4 pr-4 py-4 bg-surface-container-low focus:bg-surface-container text-on-surface rounded-xl font-body-md placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all disabled:opacity-50"
              placeholder={
                mode === "data"
                  ? "Ask about your data… e.g. How many students attended?"
                  : model ? "Ask anything…" : "Waiting for model connection..."
              }
            />
            {isLoading ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-error text-on-error hover:opacity-90 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || (mode === "chat" && !model)}
                className={`flex items-center justify-center w-12 h-12 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 ${
                  mode === "data" ? "bg-secondary text-on-secondary" : "bg-primary text-on-primary"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
