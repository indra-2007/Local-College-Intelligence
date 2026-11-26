"use client";

import { useEffect, useState, type ReactNode } from "react";
import { modeLabels, routeLabels, type Message } from "@/lib/conversations";
import DataTable from "@/components/workspace/DataTable";
import Icon from "@/components/workspace/Icon";
import styles from "./chat.module.css";

const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function textBlocks(text: string) {
  const parts: ReactNode[] = [];
  let offset = 0;
  const plain = (s: string) => s.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2,-2)}</strong>
    : part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1,-1)}</code> : part);
  for (const match of text.matchAll(/^```[^\n]*\n([\s\S]*?)(?:^```[ \t]*(?=\n|$)|$(?![\s\S]))/gm)) {
    const from = match.index ?? 0;
    if (from > offset) parts.push(<div key={`p${from}`}>{plain(text.slice(offset, from))}</div>);
    parts.push(<pre key={`c${from}`}><code>{match[1].trimEnd()}</code></pre>);
    offset = from + match[0].length;
  }
  if (offset < text.length) parts.push(<div key="end">{plain(text.slice(offset))}</div>);
  return parts;
}

function CopyReply({ message }: { message: Message }) {
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const sql = message.sqlMeta?.sql;
  const sources = message.docSources ?? [];
  const copyQuery = sql && message.mode !== "ask";
  const label = copyQuery ? "Copy SQL" : sources.length ? "Copy with sources" : "Copy answer";
  async function copy() {
    const citations = sources.map(s => [s.source, s.section].filter(Boolean).join(" — "));
    const text = copyQuery ? sql : [message.content, sql, ...citations].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Copied");
    } catch {
      setFeedback("Select the text to copy");
    }
  }
  return <button type="button" className={styles.copy} onClick={() => void copy()} aria-label={label}>
    <Icon name={feedback === "Copied" ? "check" : "copy"} size={14} /><span aria-live="polite">{feedback || label}</span>
  </button>;
}

export default function Transcript({ messages, busy, showTimes = false }: { messages: Message[]; busy: boolean; showTimes?: boolean }) {
  return <ol className={styles.transcript} aria-label="Conversation">
    {messages.map((m, i) => {
      const user = m.role === "user";
      const time = showTimes ? Date.parse(m.timestamp) : NaN;
      const waiting = !user && !m.content && busy && i === messages.length - 1;
      return <li key={`${i}-${m.timestamp}`} className={user ? styles.userTurn : styles.answerTurn}>
        <div className={styles.byline}><span>{user ? "You" : "C-GPT"}</span>
          {!user && <small>{modeLabels[m.mode ?? "chat"] || "Chat"}</small>}
          {Number.isFinite(time) && <time dateTime={m.timestamp}>{clock.format(time)}</time>}
        </div>
        {waiting && <p className={styles.waiting}>Working<span aria-hidden="true">…</span></p>}
        {m.content && <div className={styles.messageBody} data-error={m.status === "error" || undefined}>{textBlocks(m.content)}</div>}
        {m.status === "stopped" && <p className={styles.stopped}>Response stopped.</p>}
        {!user && m.route && routeLabels[m.route] && <span className={styles.routeTag} data-route={m.route}>
          <Icon name={m.route === "HYBRID" ? "route" : m.route === "SQL_ONLY" ? "table" : "book"} size={14} />
          {routeLabels[m.route]}
        </span>}
        {m.mode === "ask" && m.sqlMeta?.row_count != null && !m.sqlMeta.error &&
          <small className={styles.elapsed}>{m.sqlMeta.row_count.toLocaleString()} {m.sqlMeta.row_count === 1 ? "row" : "rows"}</small>}
        {m.sqlMeta?.error && m.sqlMeta.error !== m.content && <p className={styles.sqlError}>{m.sqlMeta.error}</p>}
        {m.sqlMeta?.sql && <details className={styles.sql}><summary>Generated SQL</summary><pre><code>{m.sqlMeta.sql}</code></pre></details>}
        {m.result && m.sqlMeta?.columns && <DataTable columns={m.sqlMeta.columns} rows={m.result} label="SQL query results" />}
        {!!m.docSources?.length && <div className={styles.sources}>
          <span>Sources</span><ul>{m.docSources.map((s, n) =>
            <li key={n} title={Number.isFinite(s.distance) ? `Retrieval distance: ${s.distance}` : undefined}><Icon name="page" size={15} /><div><strong>{s.source}</strong>{s.section && <small>{s.section}</small>}</div></li>)}</ul>
        </div>}
        {typeof m.timeTakenMs === "number" && <small className={styles.elapsed}>{(m.timeTakenMs / 1000).toFixed(1)} s</small>}
        {!user && !!m.content && !m.status && !(busy && i === messages.length - 1) && <CopyReply message={m} />}
      </li>;
    })}
  </ol>;
}
