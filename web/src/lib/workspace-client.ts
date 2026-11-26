import type { AskRoute, DataRow, Source } from "./conversations";

export type Tables = Record<string, { rows: number }>;
export type ArchiveDoc = { name: string; size: number };
export type SqlReply = {
  error?: string;
  sql?: string;
  generated_sql?: string;
  row_count?: number;
  columns?: string[];
  result?: DataRow[];
};
export type DocsReply = { answer?: string; sources?: Source[]; time_taken_ms?: number };
export type AskReply = {
  answer?: string;
  error?: string;
  route?: AskRoute;
  time_taken_ms?: number;
  sql_query?: string;
  sql_result?: DataRow[];
  sql_columns?: string[];
  sql_row_count?: number;
  sql_error?: string;
  doc_sources?: Source[];
};
export type UploadReply = {
  status?: string;
  error?: string;
  detail?: string;
  type?: "structured" | "unstructured";
  table?: string;
  filename?: string;
  saved_path?: string;
  rows?: number;
  columns?: string[];
  preview?: DataRow[];
  message?: string;
};

export async function responseError(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  const detail = data?.detail ?? data?.error;
  return typeof detail === "string" && detail ? detail : fallback;
}

export async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    if (url === "/api/ask" && res.status === 404) {
      throw new Error("Automatic routing is unavailable on this service. Try Ask SQL or Ask Docs.");
    }
    throw new Error(await responseError(res, "The campus service could not complete this request."));
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
