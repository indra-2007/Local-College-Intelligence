# Proposed Architectural Recommendations & System Evolution
**Project:** Local College Intelligence ("C-GPT")  
**Target:** Long-Term Evolution, Scalability, and Clean Maintenance

---

## 1. Recommendation Overview

The current architecture is well-suited for an undergraduate prototype and departmental pilot. To transition into an institution-wide system supporting thousands of students across 15+ engineering departments, we recommend four targeted architectural improvements.

---

## 2. Recommended Improvements

### Recommendation 1: Cryptographic JWT Authentication with Session Revocation
- **Context:** The prototype stores sessions in `data/app_storage.db` and passes roles in request payloads.
- **Proposed Architecture:**
  - Standard OAuth2 password flow issuing signed JSON Web Tokens (JWT).
  - JWT payload encodes `{ "sub": user_id, "usn": usn, "role": role, "exp": expiry }`.
  - Token signed with `HMAC-SHA256` using an internal server secret.
  - Revocation blocklist cached in memory or SQLite for immediate logout.
- **Justification:** Guarantees tamper-proof role access without requiring database lookups on every read-only inference query.

---

### Recommendation 2: Asynchronous Request Queue & Backpressure Controller
- **Context:** An edge workstation running a local LLM can only evaluate one high-throughput tensor generation pass at a time. Simultaneous queries currently compete for VRAM or trigger duplicate model loads.
- **Proposed Architecture:**
  ```
  User Query ──► FastAPI ──► In-Process Async FIFO Queue ──► Ollama LLM
                                 │
                                 └── (If queue > 3, returns position estimation)
  ```
- **Justification:** Eliminates the $\approx 6.33$\,s load penalty observed during Week 0 simultaneous concurrency tests. Ensures consistent, predictable response times ($2.2$\,s to $3.2$\,s per query) under continuous campus load.

---

### Recommendation 3: Hybrid Sparse-Dense Retrieval (BM25 + Dense RAG)
- **Context:** Dense vector embeddings (`all-MiniLM-L6-v2`) excel at conceptual matching but occasionally struggle with precise alphanumeric codes (e.g., distinguishing course code `"22CS41"` from `"22CS42"`, or specific circular numbers like `"AC/2026/04"`).
- **Proposed Architecture:**
  - Compute sparse lexical score via BM25 over tokenized Markdown text.
  - Compute dense vector similarity via ChromaDB in $\mathbb{R}^{384}$.
  - Combine rankings using **Reciprocal Rank Fusion (RRF)**:
    $$\text{Score}_{\text{RRF}}(d) = \frac{1}{60 + \text{Rank}_{\text{dense}}(d)} + \frac{1}{60 + \text{Rank}_{\text{sparse}}(d)}$$
- **Justification:** Delivers 100% recall on specific course codes while retaining high semantic understanding on natural language policy queries.

---

### Recommendation 4: Containerized Multi-Environment Deployment (Docker Compose)
- **Context:** Current setup relies on local Python venvs, Windows Ollama binaries, and manual WSL IP bridging.
- **Proposed Architecture:**
  ```yaml
  version: '3.8'
  services:
    web:
      build: ./web
      ports: ["3000:3000"]
    backend:
      build: ./backend
      ports: ["8000:8000"]
      volumes: ["./data:/app/data"]
    ollama:
      image: ollama/ollama:latest
      deploy:
        resources:
          reservations:
            devices:
              - capabilities: [gpu]
  ```
- **Justification:** Eliminates cross-platform WSL-to-Windows networking issues; enables reproducible, single-command installation on any campus server.

