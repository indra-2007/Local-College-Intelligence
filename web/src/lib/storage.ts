// Shared localStorage helpers for documents and chat history

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  content?: string; // base64 or extracted text for context
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
const CHAT_KEY = "aidash_chat_sessions";

// ── Documents ────────────────────────────────────────────────────────────────

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

// ── Chat Sessions ────────────────────────────────────────────────────────────

export function getChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveChatSessions(sessions: ChatSession[]) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(sessions));
}

export function upsertChatSession(session: ChatSession) {
  const all = getChatSessions();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    all[idx] = session;
  } else {
    all.unshift(session);
  }
  saveChatSessions(all);
}

export function deleteChatSession(id: string) {
  saveChatSessions(getChatSessions().filter((s) => s.id !== id));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
