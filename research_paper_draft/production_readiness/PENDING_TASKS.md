# Master Checklist of Pending Production Tasks
**Project:** Local College Intelligence ("C-GPT")  
**Target:** Production-Grade Campus Deployment

---

## 1. Task Summary by Priority

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL PENDING TASKS: 21                                    │
│  ├── CRITICAL (Security & Correctness):  4 Tasks            │
│  ├── HIGH (Reliability & Deployment):    8 Tasks            │
│  ├── MEDIUM (Performance & Usability):   6 Tasks            │
│  └── LOW (Nice-to-have Polish):          3 Tasks            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Master Task Register

| Task ID | Component / Area | Description | Priority | Complexity | Dependencies | Acceptance Criteria |
|---|---|---|---|---|---|---|
| **TSK-SEC-01** | Security / Auth | Cryptographic Server-Side JWT Validation: derive user role strictly from verified JWT token, not request payload. | **CRITICAL** | Medium | None | Altered request payload role cannot access higher-privilege document chunks. |
| **TSK-SEC-02** | Security / SQL | Formal SQL Abstract Syntax Tree (AST) parser using `sqlparse`: verify that only single, pure `SELECT` statements pass. | **CRITICAL** | Low | None | Adversarial queries (`SELECT 1; DROP TABLE...`, `SELECT /*comment*/`) are blocked 100%. |
| **TSK-QA-01** | Testing / CI | Create automated `pytest` test suite covering all FastAPI endpoints and edge cases. | **CRITICAL** | Medium | None | `pytest` runs in under 30s with 0 failures and 80%+ code coverage. |
| **TSK-QA-02** | Testing / Security | Build automated fuzzing and injection test suite for SQL and RAG query endpoints. | **CRITICAL** | Low | TSK-SEC-02 | 50+ adversarial SQL and prompt injection inputs are safely rejected. |
| **TSK-DEP-01** | Deployment | Setup Nginx reverse proxy with self-signed SSL/TLS on server node to eliminate client SSH tunnels. | **HIGH** | Medium | None | Any campus browser can navigate to `https://cgpt.rvce.local` directly. |
| **TSK-DEP-02** | DevOps / Daemon | Create `systemd` service units for auto-starting FastAPI backend and Ollama on server boot. | **HIGH** | Low | None | System survives server reboot and resumes answering queries automatically. |
| **TSK-ARC-01** | Architecture / Concurrency | Implement in-memory FIFO request queue (`asyncio.Queue`) to serialize overlapping LLM requests. | **HIGH** | Medium | None | Simultaneous queries queue cleanly with user feedback ("Your query is #2 in queue"). |
| **TSK-SEC-03** | Security / API | Implement API rate limiting using `slowapi` (e.g., max 15 queries per user per minute). | **HIGH** | Low | TSK-SEC-01 | Rapid programmatic query loops receive HTTP 429 Too Many Requests. |
| **TSK-SEC-04** | Security / Upload | Enforce strict file size limits (50MB) and MIME magic byte validation on `/upload`. | **HIGH** | Low | None | Non-tabular binary files or oversized archives are rejected before disk write. |
| **TSK-DAT-01** | Data / PII | Automated PII masking during CSV import (mask phone numbers, Aadhaar, private email addresses). | **HIGH** | Medium | None | Uploaded student rosters mask private fields before writing to SQLite. |
| **TSK-DAT-02** | Data / Recovery | Automated daily database snapshot script backing up `institutional.db` and ChromaDB to backup directory. | **HIGH** | Low | None | Backup cron produces verifiable timestamped `.tar.gz` archive daily. |
| **TSK-DOC-01** | Documentation | Complete Administrator Operations Guide detailing server IP changes, model swapping, and emergency restart. | **HIGH** | Low | None | Non-technical lab technician can restart and operate the system from the guide. |
| **TSK-RAG-01** | RAG / Metric | Establish Cosine Distance cutoff threshold ($\epsilon \approx 0.65$) to reject unrelated questions cleanly. | **MEDIUM** | Low | None | Queries like "How to make coffee?" return clean refusal without retrieving distant chunks. |
| **TSK-SQL-01** | SQL / Multi-Join | Expand few-shot library with multi-table JOIN examples (Student + Marks + Attendance). | **MEDIUM** | Medium | None | Questions requiring JOINs across 2-3 tables succeed with >85% accuracy. |
| **TSK-UI-01** | Frontend / UX | Client-side CSV preview before uploading to show detected columns and alert on malformed rows. | **MEDIUM** | Low | None | User sees tabular preview and row count in upload dropzone before clicking upload. |
| **TSK-UI-02** | Frontend / Resilience | Add exponential backoff auto-reconnect logic when backend connection drops. | **MEDIUM** | Low | None | UI attempts reconnect every 3s and auto-resumes once backend comes online. |
| **TSK-DEP-03** | DevOps / Docker | Author `docker-compose.yml` for reproducible single-command deployment across platforms. | **MEDIUM** | High | TSK-DEP-01 | `docker compose up -d` boots entire application on any clean Linux workstation. |
| **TSK-RAG-02** | RAG / Hybrid | Hybrid sparse-dense retrieval: combine BM25 keyword matching with dense vectors via Reciprocal Rank Fusion. | **MEDIUM** | High | TSK-RAG-01 | Queries with exact alphanumeric course codes (`22CS41`) achieve 100% retrieval recall. |
| **TSK-UI-03** | Frontend / Tables | Add table schema viewer and column type override option in Upload & Documents dashboard. | **LOW** | Medium | None | User can change an imported column from string to float directly in UI. |
| **TSK-UI-04** | Frontend / Theme | Dark mode / Light mode toggle conforming to institutional brand color guidelines. | **LOW** | Low | None | User preference persists in localStorage. |
| **TSK-EVAL-01** | Evaluation / Benchmark | Expand synthetic benchmark to 100+ multi-department verified test questions with precision/recall reporting. | **LOW** | Medium | None | Full benchmark runs automatically and outputs PDF evaluation report. |

