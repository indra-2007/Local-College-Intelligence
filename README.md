# 🎓 C-GPT — Local College Intelligence

> An offline, privacy-first AI dashboard for institutional use.  
> No internet. No API keys. No data leaves your network.

---

## 🧠 What Is This?

**C-GPT** is an AI-powered institutional dashboard that lets you:

- Upload student data (CSV/Excel — attendance, marks, etc.)
- Ask questions in plain English → get SQL-powered answers from your data
- Chat with a local LLM (Ollama) for general academic queries
- Search institutional documents (regulations, circulars) using RAG
- Role-based access: Student, Faculty, HOD, Admin

---

## 🖥️ Deployment Architecture

| Machine | Role | What Runs |
|---|---|---|
| **Frontend Laptop** | Dev / Client | Next.js 16 frontend (browser UI) |
| **Backend Server** | High-GPU server | FastAPI + Ollama LLM + SQLite + ChromaDB |

The two machines communicate over an **SSH tunnel** on the local network.

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | **Next.js 16** (TypeScript/React) | Browser UI |
| Styling | **Tailwind CSS v4** | Design system |
| Backend API | **FastAPI** (Python) | REST API, file handling, SQL |
| Database | **SQLite** | Structured CSV/Excel data |
| Vector DB | **ChromaDB** | RAG document embeddings |
| Embeddings | **sentence-transformers** (MiniLM) | 384-dim question vectors |
| LLM | **Ollama** (`qwen2.5-coder:7b`) | Local AI — SQL + RAG generation |
| Auth | **PBKDF2** password hashing (SQLite) | User accounts + sessions |
| Tunnel | **SSH port forwarding** | Frontend ↔ Backend secure link |

---

## 📐 Architecture Diagram

```
BROWSER (localhost:3000)
        │
        ▼
NEXT.JS FRONTEND (Frontend Laptop)
   ├── /api/chat        ──SSH tunnel──▶  <SERVER_IP>:11434  (Ollama — Windows)
   ├── /api/ask-sql     ──SSH tunnel──▶  <SERVER_IP>:8000   (FastAPI — WSL/Linux)
   ├── /api/ask-docs    ──SSH tunnel──▶  <SERVER_IP>:8000
   ├── /api/upload      ──SSH tunnel──▶  <SERVER_IP>:8000
   └── /api/tables      ──SSH tunnel──▶  <SERVER_IP>:8000
                                              │
                                    ┌─────────┴──────────┐
                                    │    FASTAPI :8000    │
                                    │  - Upload CSV       │
                                    │  - Run SQL          │
                                    │  - RAG pipeline     │
                                    │  - Auth / sessions  │
                                    └──────┬──────────────┘
                                           │
                            ┌──────────────┼──────────────┐
                            ▼              ▼              ▼
                        SQLite         ChromaDB         Ollama
                   institutional.db   (RAG index)   qwen2.5-coder:7b
```

---

## ✅ Feature List

### 🤖 AI Assistant (3 modes)
| Mode | How It Works |
|---|---|
| **Chat** | Streams directly from Ollama (like local ChatGPT) |
| **Ask Data** | Question → LLM generates SQL → Python runs it on SQLite → Answer |
| **Ask Docs** | Question → embedded → ChromaDB similarity search → LLM answers from chunks |

### 📁 Upload & Documents
- Drag & drop CSV / XLSX / XLS / JSON
- Auto-detects and skips banner/title rows
- Percentage strings auto-converted to numbers (`"85%"` → `85.0`)
- Preview + table management (view, delete)

### 🔐 Auth & Roles
- Login with role: `student`, `faculty`, `hod`, `admin`
- Role-based RAG access control (embedded in ChromaDB metadata)
- PBKDF2 hashed passwords, stored in `data/app_storage.db`

### 💬 Chat History
- All sessions auto-saved to browser localStorage
- Browse, expand, delete past conversations

### 📜 Ask Docs (RAG)
- Semantic search across institutional documents (regulations, circulars, syllabus)
- Returns answer + source citations `[filename > section]`
- Fully offline — embeddings computed on CPU

---

## 🗂️ Project Structure

```
project-root/
├── backend/
│   ├── main.py           ← FastAPI app — all routes
│   ├── config.py         ← Reads .env (Ollama URL, model, DB paths)
│   ├── llm_service.py    ← Centralized LLM calls (thread-safe model switching)
│   ├── auth_storage.py   ← User auth + chat persistence (SQLite)
│   └── rag.py            ← RAG pipeline (embed → ChromaDB → Ollama)
│
├── web/
│   └── src/app/
│       ├── (auth)/login/         ← Login page
│       ├── (dashboard)/
│       │   ├── ai-assistant/     ← Chat + Ask Data + Ask Docs
│       │   ├── upload/           ← File upload + table manager
│       │   ├── chat-history/     ← Saved sessions
│       │   └── regulations/      ← Academic regulations page
│       └── api/
│           ├── chat/             ← Streams from Ollama
│           ├── ask-sql/          ← Proxies to FastAPI /ask-sql
│           ├── ask-docs/         ← Proxies to FastAPI /ask-docs
│           ├── upload/           ← Proxies to FastAPI /upload
│           ├── tables/           ← Proxies to FastAPI /tables
│           └── models/           ← Lists Ollama installed models
│
├── unstructured_data/
│   └── synthetic/        ← Markdown regulation docs for RAG indexing
│
├── data/                 ← Auto-created at runtime (gitignored)
│   ├── institutional.db  ← SQLite (uploaded CSV data)
│   ├── app_storage.db    ← SQLite (user accounts, chat logs)
│   └── chroma/           ← ChromaDB vector index
│
├── .env                  ← Local config (gitignored — see .env.example)
└── requirements.txt      ← Python dependencies
```

---

## ⚙️ Configuration (`.env`)

Copy `.env.example` to `.env` and edit:

```env
# Ollama endpoint — where the LLM is running
# Same machine (Windows native):
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Ollama running on Windows host, FastAPI in WSL:
# OLLAMA_BASE_URL=http://<WSL_GATEWAY_IP>:11434

# Default generation model (must be pulled in Ollama first)
DEFAULT_MODEL=qwen2.5-coder:7b

# Optional overrides (defaults shown)
# DB_PATH=data/institutional.db
# CHROMA_DIR=data/chroma
# EMBED_MODEL=all-MiniLM-L6-v2
```

---

## 🚀 Daily Startup (SSH Tunnel Setup)

### On the **Backend Server**

**1. Start Ollama** (if not already running as a service):
```bash
ollama serve
```

**2. Start FastAPI** (in WSL or Linux terminal):
```bash
cd /path/to/project
source venv/bin/activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

---

### On the **Frontend Laptop** (Windows PowerShell)

**3. Open SSH tunnel** — keep this window open the entire session:
```powershell
# Replace <SERVER_IP> with the server's Wi-Fi IP (run ipconfig on server to find it)
# Replace <WSL_IP> with WSL's internal IP (run: wsl hostname -I  on server)
# Replace <SSH_USER> with the local Windows account on the server

ssh -L 8000:<WSL_IP>:8000 -L 11435:127.0.0.1:11434 -N <SSH_USER>@<SERVER_IP>
```

> **Why two targets?**  
> - Port `8000` → WSL IP directly (FastAPI runs inside WSL/Linux)  
> - Port `11435` → server localhost (Ollama runs natively on Windows)

**4. Run the frontend** in a new PowerShell tab:
```powershell
cd /path/to/project/web
npm run dev
```

**5. Open browser:**
```
http://localhost:3000
```

---

## 📦 One-Time Setup

### Backend (Linux / WSL)
```bash
cd /path/to/project
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Pull the LLM model
ollama pull qwen2.5-coder:7b

# Index documents for RAG (run once, re-run if docs change)
python backend/ingest.py
```

### Frontend (Windows)
```powershell
cd /path/to/project/web
npm install
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/tables` | List all SQLite tables with row counts |
| `POST` | `/upload` | Upload CSV/Excel → save to SQLite |
| `POST` | `/ask-sql` | Natural language → SQL → result |
| `POST` | `/ask-docs` | RAG: question → document answer + sources |
| `GET` | `/tables/{name}` | Preview rows of a table |
| `DELETE` | `/tables/{name}` | Delete a table |
| `GET` | `/models` | List Ollama installed models |
| `GET` | `/models/active` | Get current active model |
| `POST` | `/models/active` | Switch active model at runtime |
| `POST` | `/auth/login` | Login → JWT session |
| `GET` | `/chats` | Get chat history for user |
| `POST` | `/chats` | Save a chat session |

---

## 🔐 Default Credentials (Development Only)

| Role | Email | Password |
|---|---|---|
| Student | `student@rvce.edu.in` | `Student@123` |
| Faculty | `faculty@rvce.edu.in` | `Faculty@123` |
| HOD | `hod@rvce.edu.in` | `Hod@123` |
| Admin | `admin@rvce.edu.in` | `Admin@123` |

> Change these before any real deployment.

---

## 🔧 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `fetch failed` on Ask Data / Upload | FastAPI not reachable via tunnel | Check SSH tunnel is open and FastAPI is running on server |
| `Empty reply from server` on port 8000 | Tunnel points to Windows, FastAPI is in WSL | Use `<WSL_IP>:8000` in SSH `-L` flag instead of `localhost:8000` |
| Chat works, Ask Data doesn't | FastAPI down; chat goes direct to Ollama | Start uvicorn on server |
| RAG slow on first query | sentence-transformers downloading model | Wait — downloads once, cached permanently after |
| `ModuleNotFoundError: No module named 'uvicorn'` | Running outside venv | Activate venv first: `source venv/bin/activate` |
| Attendance query returns wrong rows | Attendance stored as text `"85%"` not number | Re-upload CSV — percentage cleaning is now automatic |
| `Permission denied` on SSH | Wrong username or Microsoft account | Use a local Windows account, not a Microsoft-linked one |

---

## 🛡️ Security Notes

- LLM **never executes code** — only generates SQL text
- SQL safety blocklist: `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `CREATE`, `ATTACH`
- Only `SELECT` queries run against the database
- RAG role filter runs **inside ChromaDB** — restricted chunks never reach the LLM
- All traffic between machines is encrypted via SSH tunnel
- `.env` and `data/` are gitignored — no credentials or student data in version control

---

## 📊 Data Upload Format

Your CSV/Excel must have **column headers in Row 1**:

✅ Correct:
```
USN, Student_Name, Section, Attendance
1RV25CI001, Aarav Sharma, A, 85
```

❌ Wrong (causes unnamed columns):
```
Student Master & Course Details     ← DELETE THIS
                                    ← DELETE BLANK ROW
USN, Student_Name, ...              ← This should be Row 1
```

---

## 🔄 RAG Pipeline Explained

```
Your question
     │
     ▼ sentence-transformers (CPU, ~2s)
384-dim vector
     │
     ▼ ChromaDB similarity search (role-filtered)
Top-4 matching document chunks
     │
     ▼ Prompt: "Answer ONLY from the context below..."
     │
     ▼ Ollama (qwen2.5-coder:7b, GPU)
Answer text + [source > section] citations
```

---

*Built for RVCE — Institutional AI Dashboard Project*  
*Stack: Next.js 16 · FastAPI · SQLite · ChromaDB · Ollama · SSH Tunnel*
