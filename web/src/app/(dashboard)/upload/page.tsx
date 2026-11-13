"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface DbTable {
  rows: number;
}

interface RagDoc {
  name: string;
  size: number;
}

interface UploadResult {
  status: string;
  type?: "structured" | "unstructured";
  table?: string;
  rows?: number;
  columns?: string[];
  preview?: Record<string, unknown>[];
  filename?: string;
  saved_path?: string;
  message?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPTED_EXT = [".csv", ".xlsx", ".xls", ".json", ".md", ".txt"];

export default function UploadPage() {
  const [tables, setTables] = useState<Record<string, DbTable>>({});
  const [documents, setDocuments] = useState<RagDoc[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [backendDown, setBackendDown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch("/api/tables");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTables(data.tables || {});
      setBackendDown(false);
    } catch {
      setBackendDown(true);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchTables();
    fetchDocuments();
  }, [fetchTables, fetchDocuments]);

  const processFile = useCallback(async (file: File) => {
    setError("");
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      setError(`Unsupported format: ${ext}. Use CSV, XLSX, XLS, JSON, or MD, TXT.`);
      return;
    }

    setUploading(true);
    setLastUpload(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Upload failed.");
      } else {
        setLastUpload(data as UploadResult);
        await fetchTables();
        await fetchDocuments();
      }
    } catch {
      setError("Could not reach the backend. Is the FastAPI server running and tunnel open? (localhost:8000)");
    } finally {
      setUploading(false);
    }
  }, [fetchTables, fetchDocuments]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const deleteTable = async (tableName: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableName)}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "Delete failed.");
      } else {
        if (lastUpload?.table === tableName) setLastUpload(null);
        await fetchTables();
      }
    } catch {
      setError("Could not reach the backend.");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const tableList = Object.entries(tables);

  return (
    <div className="max-w-5xl mx-auto w-full px-space-base md:px-space-xl py-space-xl space-y-space-xl">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Upload &amp; Documents</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Upload files to the server. Structured data goes into SQLite (Ask Data); Markdown/Text docs go into ChromaDB (Ask Docs RAG).
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          <div className={`flex items-center gap-space-xs px-space-md py-space-sm rounded-xl shadow-sm border text-on-surface-variant ${backendDown ? "bg-error/10 border-error/20" : "bg-surface-container-lowest border-surface-variant"}`}>
            <span className={`material-symbols-outlined text-[16px] ${backendDown ? "text-error" : "text-secondary"}`}>
              {backendDown ? "cloud_off" : "storage"}
            </span>
            <span className="font-label-sm text-label-sm">
              {backendDown ? "Backend offline" : `${tableList.length} table${tableList.length !== 1 ? "s" : ""} in SQLite`}
            </span>
          </div>
          {!backendDown && (
            <div className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl shadow-sm border bg-surface-container-lowest border-surface-variant text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-tertiary">menu_book</span>
              <span className="font-label-sm text-label-sm">
                {documents.length} RAG doc{documents.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Backend offline banner */}
      {backendDown && (
        <div className="flex items-start gap-space-sm px-space-lg py-space-md rounded-xl bg-error/10 border border-error/20">
          <span className="material-symbols-outlined text-[20px] text-error mt-0.5">warning</span>
          <div>
            <p className="font-label-md text-label-md text-error font-semibold">FastAPI backend is not running</p>
            <p className="font-code-sm text-code-sm text-on-surface-variant mt-1">
              Run this in your server terminal from the project root:
            </p>
            <code className="block mt-1 px-space-sm py-space-xs bg-surface-container rounded-lg font-code-sm text-code-sm text-on-surface">
              python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
            </code>
          </div>
          <button onClick={() => { fetchTables(); fetchDocuments(); }} className="ml-auto text-error hover:opacity-70 flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">refresh</span>
          </button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative bg-surface-container-lowest rounded-xl shadow-sm border-2 border-dashed flex flex-col items-center justify-center gap-space-md transition-all cursor-pointer select-none min-h-[220px] ${
          dragging ? "border-primary bg-primary-container/10 scale-[1.01]" : "border-surface-variant hover:border-primary/50 hover:bg-surface-container-low"
        } ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.json,.md,.txt" className="hidden" onChange={onInputChange} />
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${dragging ? "bg-primary-container" : "bg-surface-container"}`}>
          <span className={`material-symbols-outlined text-[36px] transition-all ${dragging ? "text-on-primary" : uploading ? "animate-spin text-primary" : "text-on-surface-variant"}`}>
            {uploading ? "refresh" : dragging ? "download" : "upload_file"}
          </span>
        </div>
        <div className="text-center space-y-space-2xs px-space-md">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {uploading ? "Uploading and indexing on server…" : dragging ? "Drop file to upload" : "Drag & Drop files here"}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <strong>Structured:</strong> CSV, XLSX, JSON (saved to <code>structured_data/</code> &amp; SQLite)<br />
            <strong>RAG Docs:</strong> MD, TXT (saved to <code>unstructured_data/</code> &amp; indexed in ChromaDB)
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-space-xs px-space-md py-space-sm rounded-lg bg-error/10 border border-error/20">
          <span className="material-symbols-outlined text-[18px] text-error mt-0.5">error</span>
          <p className="font-body-sm text-body-sm text-error flex-1">{error}</p>
          <button onClick={() => setError("")} className="text-error hover:opacity-70 flex-shrink-0">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Last upload success */}
      {lastUpload && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden">
          <div className="px-space-lg py-space-md border-b border-surface-variant flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {lastUpload.type === "unstructured" ? (
                <>Document Uploaded: <code className="font-code-sm text-code-sm bg-surface-container px-1.5 py-0.5 rounded">{lastUpload.filename}</code></>
              ) : (
                <>Table Loaded: <code className="font-code-sm text-code-sm bg-surface-container px-1.5 py-0.5 rounded">{lastUpload.table}</code></>
              )}
            </span>
            <span className="ml-auto font-code-sm text-code-sm text-on-surface-variant">
              {lastUpload.type === "unstructured" ? "Indexed into RAG" : `${lastUpload.rows ?? 0} rows · ${(lastUpload.columns ?? []).length} columns`}
            </span>
          </div>

          <div className="px-space-lg py-space-sm bg-surface-container-low text-xs text-on-surface-variant border-b border-surface-variant">
            {lastUpload.message || `Saved to server: ${lastUpload.saved_path}`}
          </div>

          {/* Column pills if structured */}
          {lastUpload.columns && lastUpload.columns.length > 0 && (
            <div className="px-space-lg py-space-sm flex flex-wrap gap-space-xs border-b border-surface-variant">
              {lastUpload.columns.map((col) => (
                <span key={col} className="px-space-xs py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant">
                  {col}
                </span>
              ))}
            </div>
          )}

          {/* Preview rows if structured */}
          {lastUpload.preview && lastUpload.preview.length > 0 && lastUpload.columns && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low">
                  <tr>
                    {lastUpload.columns.map((col) => (
                      <th key={col} className="px-space-md py-space-sm font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant">
                  {lastUpload.preview.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      {lastUpload.columns!.map((col) => (
                        <td key={col} className="px-space-md py-space-sm font-code-sm text-code-sm text-on-surface whitespace-nowrap">
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Two Columns: SQLite Tables & RAG Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
        {/* All tables in DB */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden flex flex-col">
          <div className="px-space-lg py-space-md border-b border-surface-variant">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-secondary">table_chart</span>
              SQLite Tables (Ask Data)
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Stored in <code>data/institutional.db</code> &amp; <code>structured_data/</code></p>
          </div>
          <div className="divide-y divide-surface-variant flex-1 overflow-y-auto max-h-[350px]">
            {tableList.length === 0 ? (
              <div className="p-space-lg text-center text-sm text-on-surface-variant opacity-70">
                No tables uploaded yet.
              </div>
            ) : (
              tableList.map(([name, meta]) => (
                <div key={name} className="flex items-center gap-space-md px-space-lg py-space-sm hover:bg-surface-container-low transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface font-semibold truncate">
                      <code className="font-code-sm">{name}</code>
                    </p>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">{meta.rows.toLocaleString()} rows</span>
                  <button
                    id={`delete-table-${name}`}
                    onClick={() => setConfirmDelete(name)}
                    title="Delete table"
                    className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* All RAG Documents */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden flex flex-col">
          <div className="px-space-lg py-space-md border-b border-surface-variant">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-tertiary">menu_book</span>
              RAG Documents (Ask Docs)
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Stored in <code>unstructured_data/synthetic/</code></p>
          </div>
          <div className="divide-y divide-surface-variant flex-1 overflow-y-auto max-h-[350px]">
            {documents.length === 0 ? (
              <div className="p-space-lg text-center text-sm text-on-surface-variant opacity-70">
                No markdown documents found on server.
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.name} className="flex items-center gap-space-md px-space-lg py-space-sm hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-tertiary flex-shrink-0">description</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface truncate" title={doc.name}>
                      <code className="font-code-sm">{doc.name}</code>
                    </p>
                  </div>
                  <span className="font-code-sm text-code-sm text-on-surface-variant flex-shrink-0">
                    {formatBytes(doc.size)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-xl w-full max-w-sm mx-4 p-space-xl space-y-space-lg">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[20px] text-error">delete_forever</span>
              </div>
              <div>
                <p className="font-headline-sm text-headline-sm text-on-surface">Delete table?</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">This action cannot be undone.</p>
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface">
              You are about to permanently delete{" "}
              <code className="font-code-sm bg-surface-container px-1.5 py-0.5 rounded text-error">{confirmDelete}</code>{" "}
              and all its data from SQLite.
            </p>
            <div className="flex gap-space-sm justify-end">
              <button
                id="cancel-delete-btn"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-space-md py-space-sm rounded-xl font-label-md text-label-md text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-btn"
                onClick={() => deleteTable(confirmDelete)}
                disabled={deleting}
                className="px-space-md py-space-sm rounded-xl font-label-md text-label-md text-on-error bg-error hover:opacity-90 transition-opacity flex items-center gap-space-xs disabled:opacity-50"
              >
                {deleting && <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
