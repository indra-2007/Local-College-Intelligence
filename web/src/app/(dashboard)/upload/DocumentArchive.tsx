"use client";

import TitleLetters from "@/components/TitleLetters";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import Icon from "@/components/workspace/Icon";
import DataTable from "@/components/workspace/DataTable";
import shared from "@/components/workspace/workspace.module.css";
import { formatBytes, readJson, type ArchiveDoc, type Tables, type UploadReply } from "@/lib/workspace-client";
import styles from "./archive.module.css";
import { placeReadingLight } from "@/components/workspace/reading-light";

const extensions = [".md", ".txt", ".csv", ".xlsx", ".xls", ".json", ".sql"];
const extension = (file: string) => /\.[^.]+$/.exec(file)?.[0].toLowerCase() ?? "";
const isDocument = (name: string) => [".md", ".txt"].includes(extension(name));
const multipartName = (name: string) => name.replace(/\.(md|txt)$/i, match => match.toLowerCase());
type Section = "documents" | "tables";
type Inventory = { tables: Tables | null; documents: ArchiveDoc[] | null; tableError: boolean; docError: boolean };
type Receipt = { name: string; data: UploadReply; document: boolean };

export default function DocumentArchive({ role = "student" }: { role?: string }) {
  const canModify = role !== "student";
  const [inventory, setInventory] = useState<Inventory>({ tables: null, documents: null, tableError: false, docError: false });
  const [section, setSection] = useState<Section>("documents");
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState<"upload" | "delete" | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [problem, setProblem] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const catalogRequest = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);

  const refresh = useCallback(() => {
    catalogRequest.current?.abort();
    const controller = new AbortController();
    catalogRequest.current = controller;
    const options = { signal: controller.signal };
    return Promise.allSettled([
      readJson<{ tables: Tables }>("/api/tables", options),
      readJson<{ documents: ArchiveDoc[] }>("/api/documents", options),
    ]).then(([tables, docs]) => {
      if (controller.signal.aborted) return;
      setInventory(prev => ({
        tables: tables.status === "fulfilled" ? tables.value.tables ?? {} : prev.tables,
        documents: docs.status === "fulfilled" ? docs.value.documents ?? [] : prev.documents,
        tableError: tables.status === "rejected", docError: docs.status === "rejected",
      }));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void refresh();
    return () => { catalogRequest.current?.abort(); mutation.current?.abort(); };
  }, [refresh]);

  function reloadCatalog() {
    setLoading(true);
    return refresh();
  }

  function select(files: FileList | null) {
    if (!files?.length || mutation.current) return;
    setReceipt(null); setConfirm(null); setFile(null); setProblem("");
    if (files.length > 1) { setProblem("Choose one file at a time."); return; }
    const selected = files[0];
    if (!extensions.includes(extension(selected.name))) {
      setProblem("Unsupported file type. Choose one of the formats in the file guide.");
      return;
    }
    setFile(selected);
  }
  function drop(event: DragEvent) {
    event.preventDefault(); dragDepth.current = 0; setDragging(false);
    select(event.dataTransfer.files);
  }

  async function upload() {
    if (!file || mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller; setOperation("upload"); setProblem(""); setReceipt(null);
    const name = multipartName(file.name);
    try {
      const form = new FormData();
      form.append("file", file, name);
      const data = await readJson<UploadReply>("/api/upload", { method: "POST", body: form, signal: controller.signal });
      if (controller.signal.aborted) return;
      const status = data?.status?.toLowerCase() ?? "";
      const confirmed = data && (data.table || data.filename || data.saved_path || data.type || ["ok", "success", "completed"].includes(status));
      if (!confirmed || data.error || data.detail || ["error", "failed", "failure", "pending", "processing"].includes(status)) {
        throw new Error(data?.error || data?.detail || data?.message || "The server did not confirm the upload.");
      }
      const document = data.type ? data.type === "unstructured" : isDocument(name);
      setReceipt({ name, data, document }); setFile(null);
      setSection(document ? "documents" : "tables");
      await reloadCatalog();
    } catch (error) {
      if (!controller.signal.aborted) setProblem(error instanceof Error ? error.message : "The upload could not finish. Try again.");
    } finally {
      if (!controller.signal.aborted) { mutation.current = null; setOperation(null); }
    }
  }
  async function deleteTable(name: string) {
    if (mutation.current || confirm !== name) return;
    const controller = new AbortController();
    mutation.current = controller; setOperation("delete"); setProblem("");
    try {
      await readJson(`/api/tables/${encodeURIComponent(name)}`, { method: "DELETE", signal: controller.signal });
      if (controller.signal.aborted) return;
      if (receipt?.data.table === name) setReceipt(null);
      setConfirm(null);
      await reloadCatalog();
    } catch (error) {
      if (!controller.signal.aborted) setProblem(error instanceof Error ? error.message : "The table could not be deleted.");
    } finally {
      if (!controller.signal.aborted) { mutation.current = null; setOperation(null); }
    }
  }

  const tableList = inventory.tables ? Object.entries(inventory.tables) : null;
  const docs = inventory.documents;
  const list = section === "tables" ? tableList : docs;
  const listError = section === "tables" ? inventory.tableError : inventory.docError;
  const doc = file ? isDocument(file.name) : false;
  const ext = file ? extension(file.name) : "";
  const tableName = file?.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  const replacing = tableName && inventory.tables && Object.hasOwn(inventory.tables, tableName);
  const savedDoc = receipt?.document;
  const rowCount = receipt?.data.rows;
  const columnCount = receipt?.data.columns?.length;

  return <section className={styles.scrollPage} aria-labelledby="archive-heading"><div className={shared.page}>
    <header className={shared.pageHead}><h1 id="archive-heading" aria-label="Upload documents"><TitleLetters text="Upload documents" /></h1>
      <button className={shared.ghost} type="button" onClick={() => void reloadCatalog()} disabled={loading || !!operation}>
        <Icon name="refresh" size={16} />{loading ? "Refreshing…" : "Refresh"}
      </button>
    </header>
    <div className={styles.contents}>
      <div className={styles.intake}>
        {!canModify && (
          <div className={shared.notice} role="status">
            <span>Student sessions are read-only. Sign in as Faculty, HOD, or Admin to upload, replace, or delete campus data.</span>
          </div>
        )}
        <div className={`${styles.drop} ${shared.litSurface}`} onPointerMove={placeReadingLight} data-staged={!!file || undefined} data-drag={dragging || undefined} aria-busy={operation === "upload"}
          onDragEnter={e => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }}
          onDragLeave={e => { e.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
          onDragOver={e => e.preventDefault()} onDrop={drop}>
          <div className={styles.dropInner}>
            <span className={styles.fileIcon} aria-hidden="true"><Icon name={file ? (doc ? "page" : "table") : "upload"} size={24} /></span>
            <h2>{dragging ? "Drop to select" : file ? file.name : "Drop a file here"}</h2>
            <p>{file ? `${formatBytes(file.size)} · ${doc ? "Document" : "Structured data"}` : "Add a college document or dataset to the archive."}</p>
            <input ref={picker} type="file" hidden accept={extensions.join(",")} onChange={e => { select(e.target.files); e.target.value = ""; }} />
            <div className={styles.actions}>
              {file ? <>
                <button className={shared.primary} type="button" disabled={!canModify || !!operation} onClick={() => void upload()}>
                  <Icon name="upload" size={17} />{operation === "upload" ? "Uploading…" : "Upload file"}</button>
                <button type="button" className={shared.ghost} disabled={!canModify || !!operation} onClick={() => picker.current?.click()}>Change file</button>
                <button type="button" className={styles.iconBtn} disabled={!!operation} aria-label="Clear selected file" onClick={() => { setFile(null); setProblem(""); }}><Icon name="close" size={16} /></button>
              </> : <button className={shared.primary} type="button" disabled={!canModify || !!operation} onClick={() => picker.current?.click()}>Choose a file</button>}
            </div>
            {file && <small className={styles.fileNote}>
              {ext === ".txt" ? "Plain text will be sent to the document collection. Ask Docs can search indexed sources."
                : ext === ".md" ? "Ask Docs uses the access roles declared in the Markdown file."
                : ext === ".sql" ? "Uploading runs this SQL script on the campus SQLite database."
                : replacing ? `This upload replaces the existing table “${tableName}”.` : "This file will become a table for Ask SQL."}
            </small>}
          </div>
        </div>
        <aside className={styles.guide} aria-label="Supported file formats">
          <h2 aria-label="File guide"><TitleLetters text="File guide" /></h2>
          <details><summary><Icon name="book" /><span>Documents<small>MD · TXT</small></span><Icon name="chevron" size={15} /></summary>
            <p>Upload Markdown or plain text to the document collection. Ask Docs searches the indexed sources.</p></details>
          <details><summary><Icon name="table" /><span>Campus data<small>CSV · XLSX · XLS · JSON · SQL</small></span><Icon name="chevron" size={15} /></summary>
            <p>Import rows for Ask SQL, or upload a SQL script to run it on the campus database.</p></details>
        </aside>
      </div>
      {problem && <div className={shared.notice} role="alert"><div className={styles.problem}>
        <span>{problem}</span><button className={styles.iconBtn} aria-label="Dismiss error" onClick={() => setProblem("")}><Icon name="close" size={14} /></button>
      </div></div>}
      {receipt && <div className={styles.receipt}>
        <div className={styles.receiptHead}><Icon name="check" size={20} /><div>
          <h3>{savedDoc ? "Document saved" : extension(receipt.name) === ".sql" ? "SQL script processed" : "Table imported"}</h3>
          <p>{receipt.data.table || receipt.data.filename || receipt.name}{typeof rowCount === "number" ? ` · ${rowCount.toLocaleString()} ${rowCount === 1 ? "row" : "rows"}` : ""}
            {columnCount ? ` · ${columnCount} ${columnCount === 1 ? "column" : "columns"}` : ""}</p>
        </div></div>
        <p>{receipt.data.message || "The campus service confirmed the upload."}</p>
        {receipt.data.saved_path && <p className={styles.fileNote}>Saved to <code>{receipt.data.saved_path}</code></p>}
        {!!receipt.data.columns?.length && !receipt.data.preview?.length &&
          <p>Columns · {receipt.data.columns.join(", ")}</p>}
        {!!receipt.data.preview?.length && receipt.data.columns && <DataTable columns={receipt.data.columns} rows={receipt.data.preview} label="Uploaded table preview" />}
        <Link href={savedDoc ? "/ai-assistant?mode=docs" : "/ai-assistant?mode=sql"}>Open {savedDoc ? "Ask Docs" : "Ask SQL"}</Link>
      </div>}

      <section className={styles.catalog} aria-labelledby="catalog-heading">
        <div className={styles.catalogHead}><h2 id="catalog-heading" aria-label="Source catalog"><TitleLetters text="Source catalog" /></h2>
          <div className={styles.filters} role="group" aria-label="Source type">
            <button type="button" aria-pressed={section === "documents"} onClick={() => { setSection("documents"); setConfirm(null); }}>Documents{docs && <small>{docs.length}</small>}</button>
            <button type="button" aria-pressed={section === "tables"} onClick={() => setSection("tables")}>SQL tables{tableList && <small>{tableList.length}</small>}</button>
          </div>
        </div>
        {listError && <p className={styles.catalogStatus} role="status">{list ? "Showing the last available list. " : ""}The campus data service is unavailable. <button type="button" onClick={() => void reloadCatalog()} disabled={loading}>Retry</button></p>}
        {loading && !list && <p className={styles.catalogStatus} role="status">Reading the catalog…</p>}
        {list && list.length === 0 && !listError && <p className={styles.catalogStatus}>{section === "documents" ? "No documents stored yet." : "No SQL tables stored yet."}</p>}
        {section === "documents" ? <ul className={styles.entries}>{docs?.map(document => <li key={document.name}>
          <Icon name="page" size={18} /><span className={styles.itemName}>{document.name}</span><small>{formatBytes(document.size)}</small>
        </li>)}</ul> : <ul className={styles.entries}>{tableList?.map(([name, data]) => <li key={name}>
          <Icon name="table" size={18} /><span className={styles.itemName}>{name}</span><small>{data.rows.toLocaleString()} rows</small>
          <button type="button" className={styles.iconBtn} aria-label={`Delete table ${name}`} disabled={!canModify || !!operation} onClick={() => setConfirm(name)}><Icon name="trash" size={16} /></button>
          {confirm === name && <div className={styles.confirm} role="group" aria-label={`Confirm deletion of ${name}`}>
            <p>Delete <strong>{name}</strong> and its source file?</p>
            <button type="button" className={shared.ghost} disabled={!!operation} onClick={() => setConfirm(null)}>Keep table</button>
            <button type="button" className={styles.danger} disabled={!!operation} onClick={() => void deleteTable(name)}>{operation === "delete" ? "Deleting…" : "Delete table"}</button>
          </div>}
        </li>)}</ul>}
      </section>
    </div>
  </div></section>;
}
