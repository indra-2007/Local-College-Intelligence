"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface DbTable {
  rows: number;
}

interface UploadResult {
  table: string;
  rows: number;
  columns: string[];
  preview: Record<string, unknown>[];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPTED_EXT = [".csv", ".xlsx", ".xls", ".json"];

export default function UploadPage() {
  const [tables, setTables] = useState<Record<string, DbTable>>({});
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [backendDown, setBackendDown] = useState(false);
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

  useEffect(() => { fetchTables(); }, [fetchTables]);

  const processFile = useCallback(async (file: File) => {
    setError("");
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      setError(`Unsupported format: ${ext}. Use CSV, XLSX, XLS, or JSON.`);
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
      }
    } catch {
      setError("Could not reach the backend. Is the FastAPI server running? (python -m uvicorn backend.main:app)");
    } finally {
      setUploading(false);
    }
  }, [fetchTables]);

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

  const tableList = Object.entries(tables);

  return (
    <div className="max-w-5xl mx-auto w-full px-space-base md:px-space-xl py-space-xl space-y-space-xl">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="space-y-space-2xs">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Upload &amp; Documents</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            CSV/Excel files are loaded into SQLite on the server. The LLM queries them using generated SQL.
          </p>
        </div>
        <div className={`flex items-center gap-space-xs px-space-md py-space-sm rounded-xl shadow-sm border text-on-surface-variant ${backendDown ? "bg-error/10 border-error/20" : "bg-surface-container-lowest border-surface-variant"}`}>
          <span className={`material-symbols-outlined text-[16px] ${backendDown ? "text-error" : "text-secondary"}`}>
            {backendDown ? "cloud_off" : "storage"}
          </span>
          <span className="font-label-sm text-label-sm">
            {backendDown ? "Backend offline" : `${tableList.length} table${tableList.length !== 1 ? "s" : ""} in SQLite`}
          </span>
        </div>
      </div>

      {/* Backend offline banner */}
      {backendDown && (
        <div className="flex items-start gap-space-sm px-space-lg py-space-md rounded-xl bg-error/10 border border-error/20">
          <span className="material-symbols-outlined text-[20px] text-error mt-0.5">warning</span>
          <div>
            <p className="font-label-md text-label-md text-error font-semibold">FastAPI backend is not running</p>
            <p className="font-code-sm text-code-sm text-on-surface-variant mt-1">
              Run this in a new terminal from the project root:
            </p>
            <code className="block mt-1 px-space-sm py-space-xs bg-surface-container rounded-lg font-code-sm text-code-sm text-on-surface">
              python -m uvicorn backend.main:app --reload --port 8000
            </code>
          </div>
          <button onClick={fetchTables} className="ml-auto text-error hover:opacity-70 flex-shrink-0">
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
        className={`relative bg-surface-container-lowest rounded-xl shadow-sm border-2 border-dashed flex flex-col items-center justify-center gap-space-md transition-all cursor-pointer select-none min-h-[200px] ${
          dragging ? "border-primary bg-primary-container/10 scale-[1.01]" : "border-surface-variant hover:border-primary/50 hover:bg-surface-container-low"
        } ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={onInputChange} />
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${dragging ? "bg-primary-container" : "bg-surface-container"}`}>
          <span className={`material-symbols-outlined text-[36px] transition-all ${dragging ? "text-on-primary" : uploading ? "animate-spin text-primary" : "text-on-surface-variant"}`}>
            {uploading ? "refresh" : dragging ? "download" : "upload_file"}
          </span>
        </div>
        <div className="text-center space-y-space-2xs">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {uploading ? "Uploading to SQLite…" : dragging ? "Drop to upload" : "Drag & Drop files here"}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Supported: CSV, XLSX, XLS, JSON &nbsp;·&nbsp; Click to browse
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
              Loaded: <code className="font-code-sm text-code-sm bg-surface-container px-1.5 py-0.5 rounded">{lastUpload.table}</code>
            </span>
            <span className="ml-auto font-code-sm text-code-sm text-on-surface-variant">
              {lastUpload.rows} rows · {lastUpload.columns.length} columns
            </span>
          </div>
          {/* Column pills */}
          <div className="px-space-lg py-space-sm flex flex-wrap gap-space-xs border-b border-surface-variant">
            {lastUpload.columns.map((col) => (
              <span key={col} className="px-space-xs py-0.5 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant">
                {col}
              </span>
            ))}
          </div>
          {/* Preview rows */}
          {lastUpload.preview.length > 0 && (
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
                      {lastUpload.columns.map((col) => (
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

      {/* All tables in DB */}
      {tableList.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden">
          <div className="px-space-lg py-space-md border-b border-surface-variant">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">SQLite Tables</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Available for LLM SQL queries via AI Assistant.</p>
          </div>
          <div className="divide-y divide-surface-variant">
            {tableList.map(([name, meta]) => (
              <div key={name} className="flex items-center gap-space-md px-space-lg py-space-md hover:bg-surface-container-low transition-colors">
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-secondary">table_chart</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-on-surface font-semibold">
                    <code className="font-code-sm">{name}</code>
                  </p>
                </div>
                <span className="font-code-sm text-code-sm text-on-surface-variant">{meta.rows.toLocaleString()} rows</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
