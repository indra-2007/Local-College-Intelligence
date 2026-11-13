"""
backend/load_structured.py
Loads all CSV, XLSX, and JSON files from structured_data/ into SQLite (data/institutional.db).
Can be run directly:
    python backend/load_structured.py
Or imported and called via load_all_structured().
"""

import os
import re
import io
import sqlite3
import pandas as pd
from backend.config import DB_PATH

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STRUCTURED_DIR = os.path.join(ROOT_DIR, "structured_data")


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return sqlite3.connect(DB_PATH)


def load_all_structured(overwrite: bool = True):
    """
    Scan structured_data/ directory and load every CSV, Excel, or JSON file
    into a table in institutional.db named after the file.
    """
    if not os.path.exists(STRUCTURED_DIR):
        print(f"[!] structured_data directory not found at {STRUCTURED_DIR}")
        return {}

    conn = get_db()
    loaded = {}

    for fname in sorted(os.listdir(STRUCTURED_DIR)):
        name, ext = os.path.splitext(fname)
        ext = ext.lower()
        if ext not in (".csv", ".xlsx", ".xls", ".json"):
            continue

        table_name = re.sub(r"[^a-z0-9_]", "_", name.lower()).strip("_")
        if not table_name:
            continue

        fpath = os.path.join(STRUCTURED_DIR, fname)
        try:
            if ext in (".csv", ""):
                df = pd.read_csv(fpath)
            elif ext in (".xlsx", ".xls"):
                df = pd.read_excel(fpath)
            elif ext == ".json":
                df = pd.read_json(fpath)
            else:
                continue

            # Standardize column names: lowercase, alphanumeric + underscore
            df.columns = [re.sub(r"[^a-z0-9_]", "_", str(c).strip().lower()) for c in df.columns]

            # Clean percentage strings (e.g., '85%') to float numbers
            for col in df.select_dtypes(include=['object', 'str']).columns:
                non_null = df[col].dropna()
                if len(non_null) == 0:
                    continue
                str_vals = non_null.astype(str).str.strip()
                pct_matches = str_vals[str_vals.str.match(r"^\d+(\.\d+)?%$")]
                if len(pct_matches) > 0 and (len(pct_matches) / len(str_vals)) > 0.5:
                    df[col] = pd.to_numeric(
                        df[col].astype(str).str.strip().str.rstrip("%"),
                        errors="coerce",
                    )

            mode = "replace" if overwrite else "append"
            df.to_sql(table_name, conn, if_exists=mode, index=False)
            loaded[table_name] = len(df)
            print(f"[+] Loaded {fname} -> table '{table_name}' ({len(df)} rows)")

        except Exception as e:
            print(f"[-] Failed loading {fname}: {e}")

    conn.close()
    print(f"\n[✓] Done. Total tables loaded into SQLite: {len(loaded)}")
    return loaded


if __name__ == "__main__":
    load_all_structured()
