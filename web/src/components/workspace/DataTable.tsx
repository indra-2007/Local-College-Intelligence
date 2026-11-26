"use client";

import { useState } from "react";
import type { DataRow } from "@/lib/conversations";
import styles from "./workspace.module.css";

export default function DataTable({ columns, rows, label }: { columns: string[]; rows: DataRow[]; label: string }) {
  const [limit, setLimit] = useState(10);
  if (!columns.length || !rows.length) return null;
  return (
    <div className={styles.tableBox}>
      <div className={styles.tableScroll} role="region" aria-label={label} tabIndex={0}>
        <table aria-label={label}><thead><tr>{columns.map(col => <th scope="col" key={col}>{col}</th>)}</tr></thead>
          <tbody>{rows.slice(0, limit).map((row, i) => <tr key={i}>{columns.map(col =>
            <td key={col}>{row[col] == null ? "—" : String(row[col])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {rows.length > limit && <button type="button" className={styles.moreRows}
        onClick={() => setLimit(n => n + 25)}>Show more rows ({Math.min(limit, rows.length)} of {rows.length})</button>}
    </div>
  );
}
