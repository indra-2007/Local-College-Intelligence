"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getChatSessions,
  deleteChatSession,
  ChatSession,
} from "@/lib/storage";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export default function ChatHistoryPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSessions(getChatSessions());
  }, []);

  const filtered = sessions.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteChatSession(id);
    setSessions(getChatSessions());
    if (expandedId === id) setExpandedId(null);
  };

  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);

  return (
    <div className="max-w-5xl mx-auto w-full px-space-base md:px-space-xl py-space-xl space-y-space-xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Chat History</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            All conversations are stored locally on your encrypted node.
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <div className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-lowest shadow-sm border border-surface-variant text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-secondary">forum</span>
            <span className="font-label-sm text-label-sm">{sessions.length} session{sessions.length !== 1 ? "s" : ""} · {totalMessages} messages</span>
          </div>
          <Link
            href="/ai-assistant"
            className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-primary-container text-on-primary hover:opacity-90 active:scale-95 transition-all shadow-sm font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Chat
          </Link>
        </div>
      </div>

      {/* Search */}
      {sessions.length > 0 && (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-12 pr-space-lg py-3 bg-surface-container-lowest border border-surface-variant rounded-xl font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-space-md top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-surface-variant flex flex-col items-center justify-center gap-space-md min-h-[320px]">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">history</span>
          </div>
          <div className="text-center space-y-space-2xs">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">No conversations yet</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
              Your queries are strictly stored on the local node. Start a new chat to see your history here.
            </p>
          </div>
          <Link
            href="/ai-assistant"
            className="flex items-center gap-space-xs px-space-lg py-space-sm rounded-xl bg-primary-container text-on-primary hover:opacity-90 active:scale-95 transition-all font-label-md font-medium shadow-sm mt-2"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            Start a conversation
          </Link>
        </div>
      )}

      {/* No results */}
      {sessions.length > 0 && filtered.length === 0 && (
        <div className="text-center py-space-xl text-on-surface-variant font-body-md">
          No conversations match &ldquo;{search}&rdquo;
        </div>
      )}

      {/* Session list */}
      {filtered.length > 0 && (
        <div className="space-y-space-sm">
          {filtered.map((session) => {
            const isExpanded = expandedId === session.id;
            const lastMsg = session.messages[session.messages.length - 1];
            const userMsgs = session.messages.filter((m) => m.role === "user").length;

            return (
              <div
                key={session.id}
                className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden transition-all"
              >
                {/* Session header row */}
                <div
                  className="flex items-center gap-space-md px-space-lg py-space-md cursor-pointer hover:bg-surface-container-low transition-colors group"
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px] text-primary-container">chat_bubble</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-space-xs">
                      <p className="font-label-md text-label-md text-on-surface font-semibold truncate">{session.title}</p>
                      <span className="flex-shrink-0 px-space-xs py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant">{session.model}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {lastMsg ? truncate(lastMsg.content, 80) : "No messages"}
                    </p>
                  </div>
                  <div className="flex items-center gap-space-sm flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="font-code-sm text-code-sm text-on-surface-variant">{timeAgo(session.updatedAt)}</p>
                      <p className="font-code-sm text-code-sm text-on-surface-variant">{userMsgs} query{userMsgs !== 1 ? "s" : ""}</p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete session"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                    <span className={`material-symbols-outlined text-[20px] text-on-surface-variant transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Expanded messages */}
                {isExpanded && (
                  <div className="border-t border-surface-variant bg-surface-container-low/50 px-space-lg py-space-md space-y-space-md max-h-[400px] overflow-y-auto">
                    {session.messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-space-md py-space-sm text-sm font-body-sm ${
                            msg.role === "user"
                              ? "bg-primary-container text-on-primary rounded-tr-sm"
                              : "bg-surface-container-lowest text-on-surface rounded-tl-sm border border-surface-variant"
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <p className="text-[10px] opacity-60 mt-1 text-right">
                            {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
