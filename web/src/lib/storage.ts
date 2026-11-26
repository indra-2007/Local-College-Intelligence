// Shared localStorage helpers for documents and account-scoped chat history

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  content?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const DOCS_KEY = "aidash_documents";
const LEGACY_CHAT_KEY = "aidash_chat_sessions";

function chatKey(userId?: string) {
  return userId ? `${LEGACY_CHAT_KEY}:${userId}` : LEGACY_CHAT_KEY;
}

function parseSessions(raw: string | null): ChatSession[] {
  if (!raw) return [];
  try {
    const stored: unknown = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (s): s is ChatSession =>
        Boolean(s) &&
        typeof s.id === "string" &&
        typeof s.title === "string" &&
        Array.isArray(s.messages) &&
        s.messages.every(
          (m: ChatMessage) =>
            Boolean(m) &&
            typeof m.content === "string" &&
            (m.role === "assistant" || m.role === "user")
        )
    );
  } catch {
    return [];
  }
}

export function getDocs(): UploadedDocument[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DOCS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveDocs(docs: UploadedDocument[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

export function addDoc(doc: UploadedDocument) {
  saveDocs([...getDocs(), doc]);
}

export function deleteDoc(id: string) {
  saveDocs(getDocs().filter((d) => d.id !== id));
}

export function getChatSessions(userId?: string): ChatSession[] {
  if (typeof window === "undefined") return [];
  return parseSessions(localStorage.getItem(chatKey(userId)));
}

export function saveChatSessions(sessions: ChatSession[], userId?: string) {
  localStorage.setItem(chatKey(userId), JSON.stringify(sessions));
}

export function upsertChatSession(session: ChatSession, userId?: string) {
  const all = getChatSessions(userId);
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    all[idx] = session;
  } else {
    all.unshift(session);
  }
  saveChatSessions(all, userId);
}

export function deleteChatSession(id: string, userId?: string) {
  saveChatSessions(
    getChatSessions(userId).filter((s) => s.id !== id),
    userId
  );
}

export function getLegacyChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  return parseSessions(localStorage.getItem(LEGACY_CHAT_KEY));
}

export function removeLegacyChatSession(id: string) {
  if (typeof window === "undefined") return;
  const remaining = getLegacyChatSessions().filter((s) => s.id !== id);
  if (remaining.length) {
    localStorage.setItem(LEGACY_CHAT_KEY, JSON.stringify(remaining));
  } else {
    localStorage.removeItem(LEGACY_CHAT_KEY);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
