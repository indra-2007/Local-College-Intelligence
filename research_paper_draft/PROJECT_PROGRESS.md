# Project Development Progress Summary
**Project:** Local College Intelligence ("C-GPT") — Offline Institutional AI for RVCE  
**Document Purpose:** Accurate representation of current repository implementation status for academic mentor review.  
**Strict Policy:** No planned feature is marked as complete. Only verified code artifacts are classified as implemented.

---

## 1. Executive Status Overview

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL FEATURES AUDITED: 32 Subsystems / Components         │
│  ├── [A] Fully Implemented & Verified: 18 (56.3%)           │
│  ├── [B] Partially Implemented:          8 (25.0%)           │
│  └── [C] Proposed / Future Work:         6 (18.7%)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Categorization

### [A] IMPLEMENTED & CODE-VERIFIED (Working in Repository)

| Component / Subsystem | Source Location | Implementation Details | Verified By |
|---|---|---|---|
| **Dual-Tier Network Architecture** | `.env`, SSH tunnel commands | Frontend (Next.js 16) on client laptop, backend (FastAPI) on server laptop over encrypted SSH port forwarding (`8000`, `11435`). | Functional demonstration over local Wi-Fi |
| **Dense Semantic Vector RAG** | `backend/rag.py`, `backend/ingest.py` | Markdown chunking (capped at 1000 chars), embedded via `all-MiniLM-L6-v2` into 384-dim vectors, indexed in ChromaDB (`institutional_docs`). | Code inspection + query test |
| **Pre-Retrieval Role Set Filtering** | `backend/rag.py` (`where={"role_<role>": True}`) | Mathematical filtering happens inside ChromaDB query before vectors leave the DB. Zero leakage to LLM. | Query parameter verification in Chroma API |
| **Grounded Response Prompting** | `backend/rag.py` | Strict `/no_think` prefix, mandatory `[source > section]` citation instruction, strict refusal fallback string. | Week 0 benchmark log & code |
| **GPU VRAM Model Persistence** | `backend/llm_service.py` (`keep_alive: -1`) | Injected into all Ollama generate payloads. Prevents model weight eviction from GPU memory between calls. | Code review & latency check |
| **End-to-End Latency Metric** | `backend/rag.py`, `web/.../ai-assistant/page.tsx` | Captured via `time.time()` in ms; returned in API JSON and rendered as `⏱ Xs` badge in frontend message UI. | UI verification |
| **Introspective Text-to-SQL Pipeline** | `backend/main.py` (`/ask-sql`) | Dynamic schema discovery via `PRAGMA table_info`, few-shot prompt construction, sample row injection. | Backend test queries |
| **Deterministic SQL AST Guard** | `backend/main.py` | Regex gatekeeper: strictly requires `SELECT` keyword, blocks `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `ATTACH`. | Code inspection |
| **Structured Data Auto-Loader** | `backend/load_structured.py`, `backend/main.py` | Scans `structured_data/` on boot or empty DB; auto-populates SQLite tables (`attendance`, `cie_marks`, `student_details`). | Script execution & `/tables` endpoint |
| **Unified Document & Table Upload** | `backend/main.py` (`/upload`), `web/.../upload/page.tsx` | Handles `.csv`, `.xlsx`, `.xls`, `.json`, `.sql` (into SQLite) and `.md`, `.txt` (into ChromaDB + auto-reindex). | File drop tests |
| **Disk Cleanup on Table Drop** | `backend/main.py` (`/tables/{name}`) | Drops table from SQLite and removes matching source files from `structured_data/`. | Endpoint logic review |
| **WSL Host Gateway Auto-Discovery** | `backend/config.py` | Automatically extracts Windows host IP from `/etc/resolv.conf` when running inside WSL2. | Python unit validation |
| **Centralized Model Registry & Switching** | `backend/llm_service.py`, `backend/main.py` | Thread-safe active model tracking (`threading.Lock`), model query endpoint (`/models`), dynamic model switching. | Code inspection |
| **Multi-Turn Chat Streaming** | `web/src/app/api/chat/route.ts` | Direct proxy to Ollama streaming endpoint for conversational general chat mode. | Frontend chat testing |
| **LocalStorage Chat Persistence** | `web/src/lib/storage.ts` | Stores chat sessions, message histories, active models, and titles in client browser storage. | Browser inspection |
| **Synthetic Institutional Knowledge Base** | `unstructured_data/synthetic/*.md` (11 docs) | 11 comprehensive Markdown policy documents covering 2022/2024 regulations, syllabus, clubs, hostel, fees, library, placements. | File verification |
| **Automated RAG Evaluation Harness** | `backend/evaluate.py` | Test harness evaluating 20 questions in `test_questions.json`, logging hit rates and permission leak counts. | Script review |
| **Database Isolation Architecture** | `backend/config.py`, `backend/auth_storage.py` | Institutional data (`institutional.db`) is physically isolated from application user storage (`app_storage.db`). | SQLite schema verification |

---

### [B] PARTIALLY IMPLEMENTED (In Progress / Requires Hardening)

| Component | Current State | Missing Work Needed for Production |
|---|---|---|
| **Role-Based Authentication** | `backend/auth_storage.py` has PBKDF2 password hashing & session token tables; frontend accepts role selector dropdown (`student`, `faculty`). | Role is currently passed in the request body for prototyping rather than verified from a cryptographically signed server-side JWT session token. |
| **Client-Side Data Verification** | Frontend accepts CSV/Excel uploads and renders row/column preview. | Missing client-side CSV schema validation before upload (malformed headers or mixed types currently fail on server). |
| **Concurrent Request Queue** | Ollama handles single requests sequentially; multi-user concurrency behavior documented in Week 0 benchmark. | Missing asynchronous Redis/Celery or asyncio FIFO request queue to serialize overlapping requests and prevent competing VRAM load penalties. |
| **Text-to-SQL Multi-Table Joins** | Works reliably on single-table queries and simple 2-table joins with few-shot guidance. | Fails or hallucinates on complex 3+ table joins or deeply nested subqueries on 4B/7B quantized edge models. |
| **Error Boundary Handling** | Backend catches most runtime errors and returns HTTP 400/422/503. | Frontend shows toast or bubble errors, but does not offer one-click retry, connection auto-reconnect, or offline fallback. |
| **Local Vector Index Persistence** | ChromaDB persists to `data/chroma/` on server disk. | Automated snapshot backup, versioning, and migration scripts are missing. |
| **Automated Test Coverage** | `backend/evaluate.py` covers 20 RAG questions. | Missing pytest suite for FastAPI endpoints, SQL injection unit tests, and frontend Cypress/Playwright integration tests. |
| **Multi-Scheme Disambiguation** | Prompt explicitly instructs the model to state both 2022 and 2024 rules when regulations conflict. | Model occasionally blends schemes unless the scheme name is explicitly stated in the user prompt. |

---

### [C] PROPOSED / FUTURE WORK (Not Yet Implemented)

| Proposed Feature | Motivation & Description | Priority |
|---|---|---|
| **Cryptographic JWT Server-Side Auth** | Sign session tokens with HMAC-SHA256 / RSA private key; attach verified role to request context in FastAPI dependency injection (`Depends(_get_current_user)`). | Critical |
| **Async FIFO Queue with Priority Scheduling** | Asynchronous worker queue giving HOD/Faculty queries priority over student chat queries during peak load. | High |
| **Hybrid Dense-Sparse (BM25 + RAG) Search** | Combine keyword BM25 scoring with dense embeddings using Reciprocal Rank Fusion (RRF) to retrieve exact course codes (e.g., `22CS41`). | High |
| **Automated Data Sanitization Pipeline** | Strip Personally Identifiable Information (phone numbers, parent emails) from uploaded CSVs before storage in SQLite. | High |
| **Production Containerization (Docker Compose)** | Package Frontend, FastAPI, ChromaDB, and Ollama into isolated, reproducible container images. | Medium |
| **Audited Institutional Benchmark (200+ Qs)** | Comprehensive faculty-blinded evaluation across all 12 academic departments with precision/recall metrics. | Medium |

