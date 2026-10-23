# 📚 Institutional AI Dashboard — Complete Project Guide

> Written for beginners. No prior knowledge assumed.

---

## 🧠 What Is This Project?

This is an **AI-powered dashboard for a college/institution** that lets you:

- Upload student data (CSV/Excel files like attendance, marks)
- Store that data in a real database on a remote server
- Ask questions about the data in plain English — *"How many students have attendance below 75%?"*
- Get answers powered by a local AI (Ollama LLM) — **no internet, no API key, no cost**
- Chat with the AI for general questions too

---

## 🖥️ Two Computers Are Involved

| Computer | What It Is | What Runs On It |
|---|---|---|
| **Windows Laptop** | Your personal laptop (dev machine) | Next.js frontend (the website UI) |
| **Ubuntu Laptop** | A second laptop connected via WiFi | FastAPI backend + Ollama AI + SQLite database |

The two computers talk to each other over **SSH tunnel** — a secure connection through the local network.

---

## 🏗️ Tech Stack (What Technologies Are Used)

| Layer | Technology | What It Does |
|---|---|---|
| Frontend (UI) | **Next.js 16** (TypeScript/React) | The website you see in the browser |
| Styling | **Tailwind CSS** + Custom CSS variables | Makes the UI look good |
| Backend API | **FastAPI** (Python) | Handles uploads, queries, database |
| Database | **SQLite** | Stores uploaded CSV data as tables |
| AI / LLM | **Ollama** (qwen3:4b model) | Runs AI locally, generates SQL queries |
| Communication | **SSH Tunnel** | Securely connects Windows ↔ Ubuntu |
| Data Processing | **Pandas** | Reads CSV/Excel files into the database |

---

## 📐 Architecture — How Everything Connects

```
┌─────────────────────────────────────────────────────────┐
│                   YOUR BROWSER                          │
│              http://localhost:3000                       │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP requests
┌────────────────────▼────────────────────────────────────┐
│              NEXT.JS FRONTEND (Windows)                 │
│  - Dashboard UI                                         │
│  - Upload page                                          │
│  - AI Assistant chat                                    │
│  - Forwards API calls through SSH tunnel                │
└────────┬──────────────────────────┬─────────────────────┘
         │ localhost:8000            │ localhost:11435
         │ (SSH tunnel)             │ (SSH tunnel)
         ▼                          ▼
┌────────────────────┐   ┌──────────────────────────────┐
│  FASTAPI BACKEND   │   │      OLLAMA (AI Model)        │
│  (Ubuntu:8000)     │   │      (Ubuntu:11434)           │
│                    │   │                              │
│  - Receives files  │   │  - Model: qwen3:4b           │
│  - Reads CSV/Excel │   │  - Runs 100% locally         │
│  - Saves to SQLite │   │  - No internet needed        │
│  - Runs SQL        │   │  - No API key needed         │
│  - Calls Ollama    │──▶│  - Generates SQL from        │
│    directly        │   │    plain English questions   │
└────────┬───────────┘   └──────────────────────────────┘
         │
         ▼
┌────────────────────┐
│  SQLite DATABASE   │
│  (Ubuntu)          │
│  ~/project/data/   │
│  institutional.db  │
│                    │
│  Tables:           │
│  - attendance      │
│  - cie_marks       │
│  - (any CSV you    │
│     upload)        │
└────────────────────┘
```

---

## ✅ What Has Been Built (Feature List)

### 1. 🎨 Frontend Dashboard (Next.js)
A full multi-page web application with:

- **Sidebar navigation** with icons and labels
- **Header** showing user info (Student · CSE Dept) and AI status badge
- **Dark-mode compatible** design with Material You color tokens
- **Responsive** — works on different screen sizes
- **Login page** at `/login`

### 2. 📊 Main Dashboard (`/`)
- Overview cards (placeholder for stats)
- Quick action buttons linking to other pages
- Welcome section

### 3. 🤖 AI Assistant (`/ai-assistant`)
Two modes in one chat interface:

#### Chat Mode (🔵 Blue)
- Streams directly from Ollama (like ChatGPT but local)
- General questions: "Explain the attendance policy"
- Shows which AI model is connected (e.g. `qwen3:4b`)
- Live token streaming — text appears word by word
- Stop button to cancel mid-response
- All conversations auto-saved to Chat History

#### Ask Data Mode (🟣 Purple)
- Ask questions about **your uploaded CSV data** in plain English
- Works through this pipeline:
  ```
  Your question → FastAPI → Ollama generates SQL → Python runs SQL on SQLite → Answer shown
  ```
- Shows the **Generated SQL** (collapsible, so you can see what query ran)
- Shows **result table** for multi-row results
- **The LLM never sees your raw data** — it only sees the table structure (column names)
- Safety gate: blocks any destructive SQL (DROP, DELETE, UPDATE, etc.)
- Badge showing how many tables are available

### 4. 📁 Upload & Documents (`/upload`)
- **Drag & drop** or click to browse files
- Supports: CSV, XLSX, XLS, JSON
- **Auto-detects title rows** — if your Excel has a banner row ("Student Master & Course Details"), it skips it automatically and reads the real headers
- On upload:
  - File is sent to FastAPI on Ubuntu
  - Pandas reads it into a DataFrame
  - Column names are sanitized (spaces → underscores, special chars removed)
  - Data saved to SQLite as a table
  - Returns preview (first 3 rows + all column names)
- Shows all **existing tables** in SQLite with row counts
- **Delete button** to remove any table from the database

### 5. 💬 Chat History (`/chat-history`)
- All AI conversations are saved automatically to browser localStorage
- Browse past sessions with timestamps and model used
- Expand any session to read the full conversation
- Delete individual sessions

### 6. 📜 Academic Regulations (`/regulations`)
- Static page for displaying college/university rules
- Placeholder — can be filled with actual content

### 7. 👨‍💼 HOD Dashboard (`/hod`)
- Placeholder page for Head of Department analytics view

---

## 🗂️ Project Folder Structure

```
3RD/
├── web/                          ← Next.js frontend (runs on Windows)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/        ← Login page
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx      ← Main dashboard
│   │   │   │   ├── ai-assistant/ ← AI chat (Chat + Ask Data modes)
│   │   │   │   ├── upload/       ← File upload + table list
│   │   │   │   ├── chat-history/ ← Saved conversations
│   │   │   │   ├── regulations/  ← Academic regulations
│   │   │   │   └── hod/          ← HOD dashboard
│   │   │   └── api/
│   │   │       ├── chat/         ← Forwards chat to Ollama (streaming)
│   │   │       ├── ask-sql/      ← Forwards data queries to FastAPI
│   │   │       ├── upload/       ← Forwards file uploads to FastAPI
│   │   │       ├── tables/       ← Gets list of tables from FastAPI
│   │   │       └── models/       ← Gets available Ollama models
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       ← Left navigation menu
│   │   │   └── Header.tsx        ← Top bar with user info
│   │   └── lib/
│   │       └── storage.ts        ← Chat history (localStorage)
│   └── package.json
│
└── backend/
    └── main.py                   ← FastAPI server (runs on Ubuntu)
```

---

## 🔌 API Endpoints (FastAPI on Ubuntu)

| Method | URL | What It Does |
|---|---|---|
| `GET` | `/health` | Check if server is running, list tables |
| `GET` | `/tables` | List all tables with row counts |
| `POST` | `/upload` | Upload a CSV/Excel, save to SQLite |
| `POST` | `/ask-sql` | Ask a question → LLM generates SQL → run it |
| `GET` | `/preview/{table}` | See first N rows of any table |
| `DELETE` | `/tables/{table}` | Delete a table from SQLite |

---

## 🔐 Security Features

- **LLM never executes code** — it only generates SQL text
- **Safety gate** in Python blocks: `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `CREATE`, `ATTACH`
- Only `SELECT` queries are allowed to run
- Ollama runs **100% offline** — your data never leaves your network
- SSH tunnel encrypts all communication between the two laptops

---

## 🚀 How To Start Everything (Daily Checklist)

### Step 1 — On Ubuntu laptop (SSH in or open terminal directly)
```bash
# Start Ollama (if not already running)
ollama serve

# Start FastAPI backend
cd ~/project
source venv/bin/activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### Step 2 — On Windows laptop (PowerShell)
```powershell
# Open SSH tunnel (keep this window open, don't close it)
ssh -L 11435:localhost:11434 -L 8000:localhost:8000 indra@10.193.103.20 -N

# In a SEPARATE PowerShell window — start the frontend
cd C:\Users\prann\Downloads\3RD\web
npm run dev
```

### Step 3 — Open browser
```
http://localhost:3000
```

---

## 📦 One-Time Setup (Already Done — For Reference)

### Ubuntu Setup
```bash
# Create project folders
mkdir -p ~/project/backend ~/project/data

# Create Python virtual environment
cd ~/project
python3 -m venv venv
source venv/bin/activate

# Install Python packages
pip install fastapi uvicorn python-multipart pandas openpyxl requests

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download the AI model
ollama pull qwen3:4b
```

### Windows Setup
```powershell
# Install Node.js from https://nodejs.org (if not installed)

# Install frontend dependencies (run once in project folder)
cd C:\Users\prann\Downloads\3RD\web
npm install
```

---

## 🔧 Troubleshooting

| Problem | What It Means | Fix |
|---|---|---|
| "SSH tunnel not reachable on 11435" | SSH tunnel not running | Run the ssh command in PowerShell |
| "Backend offline" on upload page | FastAPI not running | Start uvicorn on Ubuntu |
| "LLM unreachable: port 11435" | Wrong Ollama port in FastAPI | FastAPI must use port 11434 (not 11435) |
| "LLM unreachable: Read timed out" | Model loading into memory | Wait 60s and try again (first request is slow) |
| `count: 0` with unnamed columns | CSV had title row / no proper headers | Delete title rows in Excel, upload again |
| Upload shows "No tables" | Upload worked but backend not connected | Check SSH tunnel and FastAPI are both running |
| Chat works but Ask Data doesn't | FastAPI is down | Ask Data needs FastAPI; Chat needs only SSH tunnel |

---

## 📊 How To Upload Data Correctly

Your CSV/Excel file must have **column headers in Row 1**:

✅ **Correct format:**
```
USN, Student Name, Section, Gender, Admission, Status, Course Code, Course Name, Credits, Department, Faculty Name, Attendance
1RV25CI00, Aarav Sharma, A, Male, KCET, Active, MA231TF, Probability, 4, MA, Dr. Rajesh, 100
```

❌ **Wrong format (causes unnamed columns):**
```
Student Master & Course Attendance Details     ← DELETE THIS ROW
                                               ← DELETE THIS BLANK ROW
USN, Student Name, ...                         ← This should be Row 1
```

---

## 🔄 The "Ask Data" Pipeline — Step by Step

When you type: *"How many students have attendance below 75?"*

```
1. Browser sends question to Next.js (/api/ask-sql)
2. Next.js forwards it to FastAPI on Ubuntu (:8000/ask-sql)
3. FastAPI reads the database schema:
   → "Table: attendance(usn TEXT, student_name TEXT, attendance REAL...)"
4. FastAPI sends this schema + your question to Ollama (local AI)
5. Ollama generates SQL:
   → "SELECT COUNT(*) as count FROM attendance WHERE attendance < 75"
6. Python safety check: Is this a SELECT? No DROP/DELETE? ✅ Safe
7. Python runs the SQL against SQLite (institutional.db on Ubuntu)
8. Result: {"count": 23}
9. Answer shown in browser: "count: 23"
10. Generated SQL shown in collapsible section below the answer
```

**The AI never sees your actual student data — only the table structure (column names and types).**

---

## 📁 Where Is The Data Stored?

| Data | Location |
|---|---|
| Uploaded CSV data (SQLite) | Ubuntu: `~/project/data/institutional.db` |
| Chat history | Windows: Browser localStorage (cleared if you clear browser data) |
| AI model files | Ubuntu: `~/.ollama/models/` |
| Frontend code | Windows: `C:\Users\prann\Downloads\3RD\web\` |
| Backend code | Windows + Ubuntu: `backend/main.py` |

---

## 🧩 Key Concepts Explained Simply

**SQLite** — A database that lives in a single file. Like Excel but for software. Every CSV you upload becomes a "table" inside this file.

**FastAPI** — A Python web server. It listens for requests (like "give me the tables" or "run this query") and responds with data.

**Ollama** — Software that runs AI models on your own computer. The model (`qwen3:4b`) is like a small ChatGPT that lives on Ubuntu.

**SSH Tunnel** — A secure pipe between two computers. Port 8000 on Windows is secretly the same as port 8000 on Ubuntu. Port 11435 on Windows is secretly port 11434 on Ubuntu.

**Next.js** — A framework built on React (JavaScript). It runs the website and also has "API routes" that act as a middleman between the browser and the backend.

**Pandas** — A Python library for working with spreadsheet data. It reads your CSV/Excel and converts it to a format SQLite understands.

---

*Built as part of Week 7/14 of the Institutional AI Dashboard project.*
*Stack: Next.js 16 · FastAPI · SQLite · Ollama (qwen3:4b) · SSH Tunnel*
