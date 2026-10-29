# 🧠 How the Institutional AI Works — Simple Guide

> This document explains what happens step-by-step when you use each feature of the dashboard.

---

## 📌 The Three Modes

| Mode | Where | What It Does |
|---|---|---|
| 💬 **Normal Chat** | AI Assistant → Chat tab | Talk to the AI like ChatGPT |
| 📊 **Ask Data (SQL)** | AI Assistant → Ask Data tab | Ask questions about uploaded CSV data |
| 📄 **Ask Docs (RAG)** | AI Assistant → Docs tab | Ask questions about college policy documents |

---

## 🖥️ The Two Computers

```
Your Windows Laptop                    Ubuntu Laptop (Server)
─────────────────────                  ──────────────────────
Next.js Frontend (website)  ←──SSH──►  FastAPI Backend (port 8000)
Browser at localhost:3000   ←──SSH──►  Ollama AI Model (port 11434)
                                       SQLite Database (institutional.db)
```

> The SSH tunnel connects them securely over your WiFi network.

---

## 💬 Mode 1 — Normal Chat

**You type:** *"Explain the attendance policy"*

```
Step 1: Browser sends your message to Next.js
         ↓
Step 2: Next.js forwards it to Ollama directly (port 11435 via SSH tunnel)
         ↓
Step 3: Ollama runs the AI model (qwen3-4b) on the Ubuntu laptop CPU
         ↓
Step 4: AI generates a response — word by word, streamed live to your screen
         ↓
Step 5: You see text appearing in real time (like ChatGPT)
```

**Key facts:**
- ✅ Completely local — no internet, no API key
- ✅ Streams live, word by word
- ✅ Conversation saved automatically to your browser's localStorage

---

## 📊 Mode 2 — Ask Data (SQL Mode)

**You type:** *"List all students with attendance less than 80%"*

### The Full Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: You type a question and hit Send                           │
│  Browser → POST /api/ask-sql → Next.js → POST /ask-sql → FastAPI   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: FastAPI reads your database schema (NOT your actual data)  │
│                                                                     │
│  It opens institutional.db and runs:                                │
│    PRAGMA table_info(attendance)  → column names + types            │
│    SELECT * FROM attendance LIMIT 1  → 1 sample row                 │
│                                                                     │
│  Builds a description like:                                         │
│    [attendance] Columns: usn TEXT, name TEXT, attendance REAL       │
│        e.g. usn='1RV25CI001', name='Aarav', attendance=75.0        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: FastAPI builds a prompt and sends to Ollama (LLM)          │
│                                                                     │
│  Prompt:                                                            │
│    "SQLite expert. Output only a SELECT query.                      │
│     Tables: [attendance] Columns: usn, name, attendance ...         │
│     Rules: use exact column names; attendance < 80, not '80%'       │
│     Question: List students with attendance less than 80%           │
│     SQL:"                                                           │
│                                                                     │
│  Ollama generates:                                                  │
│    SELECT usn, name, attendance FROM attendance WHERE attendance < 80│
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: Safety Gate (Python checks the SQL before running it)      │
│                                                                     │
│  ✅ Must start with SELECT                                          │
│  ❌ Blocked if contains: DROP / DELETE / UPDATE / INSERT / ALTER    │
│                                                                     │
│  The LLM is NEVER trusted to execute code — only to write text      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: Python executes the SQL against SQLite                     │
│                                                                     │
│  pd.read_sql_query("SELECT usn, name, attendance FROM attendance    │
│                     WHERE attendance < 80", db_connection)          │
│                                                                     │
│  Returns actual rows of data from your uploaded CSV                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 6: Results sent back to browser                               │
│                                                                     │
│  Browser shows: result table + "Generated SQL" collapsible section  │
└─────────────────────────────────────────────────────────────────────┘
```

### 🔑 Most Important Thing to Understand

> **The AI never reads your actual student data.**
>
> It only sees: column names, data types, and 1 sample row.
> Python (not the AI) does all the actual data fetching.

```
AI sees this:        attendance REAL,  e.g. attendance=75.0
AI never sees this:  500 rows of real student attendance records
```

### Why Column Names Matter

The AI matches your words to column names exactly.

| Your question says | AI looks for column | Result |
|---|---|---|
| "attendance" | `attendance` ✅ | Works perfectly |
| "attendance" | `attendance__` ⚠️ | Sometimes mismatches |
| "marks" | `marks` ✅ | Works perfectly |

**This is why clean column names in your CSV matter.** Rename `Attendance %` → `Attendance` before uploading.

---

## 📄 Mode 3 — Ask Docs (RAG Mode)

**You type:** *"What is the minimum attendance required?"*

RAG = **R**etrieval **A**ugmented **G**eneration — the AI answers from documents, not from thin air.

```
Step 1: Your question is converted into a 384-number vector
        (a mathematical fingerprint of the meaning of your sentence)
        Tool used: sentence-transformers MiniLM model (runs on CPU)
         ↓
Step 2: This vector is compared against all document chunks in ChromaDB
        ChromaDB finds the 4 most similar chunks from policy documents
        Role filter applied: student only sees student-accessible content
         ↓
Step 3: Those 4 chunks are passed to Ollama as context
        "Answer ONLY from the context below. Do not guess."
         ↓
Step 4: Ollama writes an answer based only on those chunks
        Returns: answer text + source filenames + section names
         ↓
Step 5: Browser shows the answer with [source > section] citations
```

### Key Difference from Normal Chat

| Normal Chat | Ask Docs (RAG) |
|---|---|
| AI answers from training knowledge | AI answers ONLY from your uploaded documents |
| May hallucinate or be uncertain | Cites exact source and section |
| General knowledge | Specific to your institution's rules |

---

## 📁 What Happens When You Upload a CSV

```
You upload: attendance.csv
              ↓
Filename sanitized: "attendance.csv" → table name "attendance"
              ↓
File read by Pandas into a DataFrame
              ↓
Auto-detection: Is first row a title/banner? → Skip it if yes
              ↓
Column names cleaned: "Attendance %" → "attendance__"
                      "Student Name" → "student_name"
              ↓
Percentage strings converted: "75%" → 75.0 (stored as a real number)
              ↓
DataFrame saved to SQLite as a table (replaces existing if same name)
              ↓
Preview of first 3 rows returned to browser
```

---

## 🔐 Security Design

| Threat | How It's Handled |
|---|---|
| LLM writing harmful SQL | Safety gate blocks DROP/DELETE/UPDATE/INSERT |
| LLM accessing real data | LLM only sees schema (column names), never row data |
| Role-based document access | ChromaDB filters at query time — restricted chunks never retrieved |
| Network interception | SSH tunnel encrypts all traffic between laptops |

---

## ⚙️ Daily Startup Checklist

Run these on the **Ubuntu laptop** (in order):

```bash
# Terminal 1 — Start Ollama (AI model server)
ollama serve

# Terminal 2 — Start FastAPI backend
cd ~/project
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Run this on the **Windows laptop**:

```powershell
# PowerShell — Open SSH tunnel (keep this window open)
ssh -L 11435:localhost:11434 -L 8000:localhost:8000 indra@10.193.103.20 -N

# Separate PowerShell — Start the website
cd C:\Users\prann\Downloads\3RD\web
npm run dev
```

Then open **http://localhost:3000** in your browser.

---

## 🛠️ When Something Goes Wrong

| Error | Cause | Fix |
|---|---|---|
| `LLM unreachable` | Ollama not running | Run `ollama serve` on Ubuntu |
| `502 Bad Gateway` | FastAPI can't reach Ollama | Check Ollama is running; check SSH tunnel |
| Wrong table queried | Column names confusing the LLM | Rename CSV columns to be simple words |
| `no such column` | LLM invented a column name | Re-upload CSV; column names are auto-shown to LLM |
| `100%` values showing in attendance < 80 | Stored as string not number | Re-upload CSV — auto-conversion strips `%` on upload |

