# C-GPT — Local College Intelligence

> **Privacy-first, air-gapped institutional AI for RVCE.**
> No internet. No external API keys. No data leaves your network.

---

## What Is This?

**C-GPT** is an offline AI assistant built for college institutions. It runs entirely on local hardware (a single GPU server + any client laptop) and lets faculty, HODs, and students ask natural-language questions about:

- **Student records** — attendance, CIE marks, CO/PO scores, CGPA, grades
- **Institutional documents** — regulations, handbooks, syllabi, circulars, fee policies
- **Both at once** — e.g. *"Which students are below the minimum attendance threshold per RVCE regulations?"*

The system automatically classifies each query and routes it through the right pipeline — SQL, RAG, or a hybrid of both — then fuses the results into one grounded answer.

---

## Architecture

```
Client Laptop (any browser)
  └── Next.js 16 frontend  ──SSH tunnel──►  GPU Server (Syed's machine)
                                                ├── FastAPI backend  (port 8000)
                                                ├── Ollama LLM       (port 11434)
                                                ├── SQLite           (data/institutional.db)
                                                └── ChromaDB         (data/chroma/)
```

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI, Python, Uvicorn |
| LLM runtime | Ollama (`qwen2.5-coder:7b`, CUDA) |
| Structured data | SQLite + pandas |
| Vector search | ChromaDB + `all-MiniLM-L6-v2` (sentence-transformers, CPU) |
| Auth | SQLite-backed session tokens |

---

## Features

### Unified Hybrid Query Pipeline (`/ask`)
The flagship `Ask` mode automatically classifies every query and runs the right engine:

| Route | When used | What runs |
|---|---|---|
| `SQL_ONLY` | Pure data question (counts, averages, top-N) | LLM → SQL → SQLite |
| `RAG_ONLY` | Policy / handbook / regulation question | Embed → ChromaDB → LLM |
| `HYBRID` | Needs both numbers AND policy context | SQL + RAG in parallel → fused synthesis |

Execution transparency is surfaced in the UI: route badge, generated SQL (expandable), result table, and cited document sources.

### Ask Data (SQL Pipeline)
- LLM generates a SQLite `SELECT` from natural language
- Safety gate: destructive SQL (`DROP`, `DELETE`, `UPDATE`, etc.) is rejected before execution
- Python — not the LLM — executes the query
- Percentage math rules enforced: `*_max_N_` column denominators, SQLite float-division guards

### Ask Docs (RAG Pipeline)
- Documents are chunked, embedded, and stored in ChromaDB at ingest time
- **Pre-retrieval RBAC**: role filter runs inside the vector query — restricted chunks never reach the LLM
- Source-diversity re-ranking: candidate pool of `2×k` with a cap of 2 chunks per source file so one large handbook never crowds out specific policy docs
- Sources cited inline in the answer as `[filename › section]`

### Chat Mode
- Streams directly from Ollama via Server-Sent Events
- Stop button mid-generation
- Full session history persisted in localStorage

### GPU Monitoring
- Live `/gpu` header widget (polls nvidia-smi every 5 s)
- Shows GPU utilisation %, VRAM used/total, and temperature

### Upload & Documents
- CSV / XLSX / JSON → auto-cleaned and loaded into SQLite (percentage strings → floats, title-row detection)
- Markdown / TXT → ingested into ChromaDB and immediately queryable
- SQL scripts (`.sql`) → executed directly against the database

### Role-based Access Control
Roles: `student`, `faculty`, `hod`, `admin`

- Student role restricts SQL to aggregate/summary data (no full student lists)
- ChromaDB metadata filter enforces per-role document visibility at the vector-search layer
- Role is currently passed from the UI (prototype); in production it must come from a verified session token

---

## Repository Structure

```
├── backend/
│   ├── main.py           # FastAPI app, all HTTP routes, startup warmup
│   ├── hybrid.py         # Unified hybrid pipeline: router + SQL + RAG + synthesis
│   ├── rag.py            # RAG pipeline: embed → ChromaDB → Ollama
│   ├── llm_service.py    # Centralised Ollama client, GPU semaphore, model management
│   ├── config.py         # Env-var config, WSL gateway auto-detection
│   ├── ingest.py         # Document chunking and ChromaDB indexing
│   ├── load_structured.py# Auto-load structured_data/ CSVs into SQLite at startup
│   ├── auth_storage.py   # SQLite-backed user auth and session tokens
│   └── evaluate.py       # RAG evaluation utilities
│
├── structured_data/      # CSV/XLSX files auto-loaded into SQLite
│   ├── attendance.csv
│   ├── cie_marks.csv
│   └── student_details.csv
│
├── unstructured_data/
│   └── synthetic/        # 26 Markdown institutional documents (RAG corpus)
│
├── data/                 # Runtime data (gitignored)
│   ├── institutional.db  # SQLite database
│   └── chroma/           # ChromaDB vector store
│
├── web/                  # Next.js 16 frontend
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/
│       │   │   ├── ai-assistant/   # Main AI Assistant UI (Chat, Ask Data, Ask Docs, Ask)
│       │   │   ├── upload/         # Upload & Documents page
│       │   │   ├── chat-history/   # Chat session history
│       │   │   ├── admin/          # Admin panel
│       │   │   └── hod/            # HOD panel
│       │   └── api/                # Next.js proxy routes → FastAPI
│       └── components/
│           ├── Header.tsx           # GPU widget + Local AI Online badge
│           └── Sidebar.tsx          # Navigation
│
├── requirements.txt
├── .env.example
└── README.md
```

---

## Quick Start

### Prerequisites

- **GPU server**: NVIDIA GPU, Ubuntu / WSL2, Python 3.11+, [Ollama](https://ollama.com) installed
- **Client**: Node.js 20+, pnpm

### 1. Clone

```bash
git clone https://github.com/indra-2007/Local-College-Intelligence.git
cd Local-College-Intelligence
```

### 2. Backend (on the GPU server)

```bash
# Install Python dependencies
pip install -r requirements.txt

# Pull the generation model
ollama pull qwen2.5-coder:7b

# Configure environment
cp .env.example .env
# Edit .env — set OLLAMA_BASE_URL if needed (see comments in .env.example)

# Build the RAG index from unstructured_data/synthetic/
python backend/ingest.py

# Start the backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

The startup sequence auto-loads structured CSVs into SQLite, pre-warms the embedding model and ChromaDB, and loads the LLM into GPU VRAM — first query has near-zero cold-start latency.

### 3. Frontend (on the client machine)

```bash
cd web
pnpm install
pnpm dev        # starts on port 3000
```

### 4. SSH tunnel (connecting client to GPU server)

If the frontend and backend are on different machines on the same network:

```bash
# Run on the CLIENT machine
ssh -L 8000:<SERVER_LAN_IP>:8000 -N <user>@<SERVER_LAN_IP>
```

The Next.js API proxy routes forward all `/api/*` calls to the backend over this tunnel. No browser-to-backend direct connection is needed.

---

## Environment Variables

Copy `.env.example` to `.env` in the project root and set:

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | auto-detected | Ollama API base URL |
| `DEFAULT_MODEL` | `qwen2.5-coder:7b` | Model name (must already be pulled) |
| `DB_PATH` | `data/institutional.db` | SQLite database path |
| `CHROMA_DIR` | `data/chroma` | ChromaDB persistence directory |
| `EMBED_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformer embedding model |

> **WSL users**: `config.py` auto-detects the Windows host gateway IP from `ip route` and `/etc/resolv.conf`. You can override with `OLLAMA_BASE_URL=http://<GATEWAY_IP>:11434`.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend health, tables, active model |
| `GET` | `/gpu` | Live GPU stats (nvidia-smi) |
| `GET` | `/models` | Installed Ollama models |
| `POST` | `/models/active` | Switch active generation model |
| `GET` | `/tables` | SQLite table list with row counts |
| `POST` | `/upload` | Upload CSV/XLSX/MD/SQL file |
| `GET` | `/preview/{table}` | Preview first N rows of a table |
| `DELETE` | `/tables/{table}` | Drop table and remove source file |
| `POST` | `/ask` | **Unified hybrid query** (SQL + RAG + synthesis) |
| `POST` | `/ask-sql` | SQL-only pipeline |
| `POST` | `/ask-docs` | RAG-only pipeline |
| `POST` | `/auth/login` | Authenticate and get session token |
| `GET` | `/auth/me` | Get current authenticated user |
| `GET` | `/chats` | List chat sessions (authenticated) |
| `POST` | `/chats` | Save/update a chat session |

Full interactive docs available at `/docs` when the backend is running.

---

## Data Included (Synthetic / Demo)

### Structured (SQLite)
| File | Contents |
|---|---|
| `attendance.csv` | Course-wise attendance records |
| `cie_marks.csv` | CIE marks with CO/PO mappings (Q1–Q8, EL) |
| `student_details.csv` | 200 students across CS, CI, CY, CD programs |

### Unstructured (RAG corpus — 26 documents)
Regulations (2022 & 2024 schemes), CSE CO-PO mapping, circulars, student clubs, registration, events calendar, library resources, placement cell, hostel/mess, scholarships, academic calendar, attendance grading policy, EL team rules, fee circulars, academic handbooks (assessment, registration, clubs & discipline, student services), NRI/PG fees, placement report 2025–26, CI semester scheme, Advanced AI/ML syllabus, AE course syllabi.

> All student data is **synthetic** and generated for demonstration purposes only.

---

## Concurrency & GPU Safety

- A `threading.Semaphore(1)` in `llm_service.py` serializes all non-streaming LLM calls — concurrent requests queue rather than contend for GPU VRAM.
- Streaming chat calls bypass the semaphore (each stream holds the GPU for its own duration).
- `keep_alive: -1` keeps model weights resident in VRAM between requests.
- HYBRID queries run SQL and RAG retrieval in parallel (`ThreadPoolExecutor`) before the single serialized synthesis call.

---

## Security Notes (Prototype)

- Role is currently accepted from the request body for ease of development. **In production, derive role from a verified server-side session token — never trust the client.**
- SQL safety gate rejects any non-`SELECT` statement from LLM output.
- ChromaDB pre-retrieval RBAC filter runs inside the vector query; restricted chunks are never retrieved.
- All Ollama API calls are local — no external model API is used.

---

## Contributing

1. Fork the repo and create a feature branch from `main`
2. Backend changes go in `backend/`; frontend changes in `web/`
3. Run `python -m py_compile backend/*.py` and `cd web && npx tsc --noEmit` before submitting a PR
4. The project uses conventional commits (`feat:`, `fix:`, `perf:`, `chore:`)

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built for RVCE, Bengaluru — local-first, privacy-preserving institutional AI.*
