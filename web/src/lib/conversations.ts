import {
  type ChatMessage,
  type ChatSession,
  getChatSessions,
  upsertChatSession,
} from "./storage";

export const modeLabels = {
  chat: "Chat",
  data: "Ask SQL",
  docs: "Ask Docs",
  ask: "Ask",
} as const;
export type Mode = keyof typeof modeLabels;
export const routeLabels = {
  SQL_ONLY: "SQL only",
  RAG_ONLY: "Documents only",
  HYBRID: "SQL + documents",
} as const;
export type AskRoute = keyof typeof routeLabels;
export type DataRow = Record<string, unknown>;
export type Source = { source: string; section: string; distance?: number };
export interface Message extends ChatMessage {
  mode?: Mode;
  status?: "error" | "stopped";
  route?: AskRoute;
  sqlMeta?: { sql?: string; columns?: string[]; row_count?: number; error?: string };
  result?: DataRow[];
  docSources?: Source[];
  timeTakenMs?: number;
}
export interface Thread extends ChatSession {
  messages: Message[];
}

function activeKey(userId?: string) {
  return userId ? `cgpt.activeThread:${userId}` : "cgpt.activeThread";
}

export function clearActiveThread(userId?: string) {
  try {
    sessionStorage.removeItem(activeKey(userId));
    if (!userId) sessionStorage.removeItem("cgpt.activeThread");
  } catch {
    /* Storage is optional. */
  }
}

export function selectActiveThread(id: string, userId?: string, known?: Thread[]) {
  const pool = known ?? getChatSessions(userId);
  const found = pool.find((thread) => thread.id === id);
  if (!found) return false;
  upsertChatSession(found, userId);
  sessionStorage.setItem(activeKey(userId), id);
  return true;
}

export function readActiveThread(userId?: string): Thread | undefined {
  try {
    const id = sessionStorage.getItem(activeKey(userId));
    const found = getChatSessions(userId).find((item) => item.id === id);
    return found && Array.isArray(found.messages) ? (found as Thread) : undefined;
  } catch {
    return undefined;
  }
}

export function saveActiveThread(thread: Thread, userId?: string) {
  try {
    upsertChatSession(thread, userId);
    sessionStorage.setItem(activeKey(userId), thread.id);
    return true;
  } catch {
    return false;
  }
}
