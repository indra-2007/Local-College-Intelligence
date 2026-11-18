# Phased Development Roadmap to Production Readiness
**Project:** Local College Intelligence ("C-GPT")  
**Estimated Time to Production:** 6 Weeks (Undergraduate Engineering Team Cadence)

---

## Roadmap Overview

```
Week 1: Phase A ──► Critical Security & Correctness Hardening
Week 2: Phase B ──► Architecture, Concurrency & Request Queue
Week 3: Phase C ──► Production Deployment & LAN Infrastructure
Week 4: Phase D ──► Automated Testing & Continuous Verification
Week 5: Phase E ──► Data Governance, PII Masking & Disaster Recovery
Week 6: Phase F ──► Administrative Documentation & Production Pilot
```

---

## Phase A: Critical Security & Correctness Hardening (Week 1)
*Focus: Eliminate all high-severity vulnerabilities before multi-user exposure.*

### Task A.1: Server-Side Cryptographic Role Verification (TSK-SEC-01)
- **Goal:** Replace request-body role passing with cryptographically verified JSON Web Tokens (JWT).
- **Implementation:**
  1. Modify `backend/auth_storage.py` to sign session tokens using HMAC-SHA256 with a secure server-side secret key stored in `.env`.
  2. Implement a FastAPI dependency `get_verified_user(token: str = Depends(oauth2_scheme))` in `backend/main.py`.
  3. Ensure `/ask-docs` and `/ask-sql` extract `user.role` strictly from this dependency context.
- **Affected Files:** `backend/auth_storage.py`, `backend/main.py`, `web/src/lib/auth.ts`
- **Effort:** 8 hours
- **Deliverable:** Verified unit test showing spoofed `"role": "admin"` in JSON body fails with HTTP 403.

### Task A.2: Formal Abstract Syntax Tree (AST) SQL Gate (TSK-SEC-02)
- **Goal:** Replace regex string matching with a formal SQL AST validator.
- **Implementation:**
  1. Integrate `sqlparse` library into backend requirements.
  2. Implement `validate_sql_query(sql_str: str) -> bool`:
     - Tokenizes and parses statements.
     - Confirms `len(parsed) == 1` (rejects multiple stacked queries like `SELECT 1; DROP TABLE...`).
     - Confirms statement type is strictly `SELECT`.
     - Recursively checks for forbidden mutation tokens inside subqueries or expressions.
- **Affected Files:** `backend/main.py`, `requirements.txt`
- **Effort:** 4 hours
- **Deliverable:** 100% rejection rate against 25 adversarial SQL injection attack strings.

---

## Phase B: Architecture, Concurrency & Request Queue (Week 2)
*Focus: Prevent edge workstation GPU thrashing under multiple users.*

### Task B.1: Asynchronous FIFO Inference Request Queue (TSK-ARC-01)
- **Goal:** Serialize concurrent user requests to eliminate simultaneous VRAM loading penalties.
- **Implementation:**
  1. Implement an in-process `asyncio.Queue` in `backend/llm_service.py`.
  2. Enqueue incoming prompts; an asynchronous worker pops queries sequentially, executes the local Ollama API call, and returns the result through an `asyncio.Future`.
  3. Return queue position feedback if queue length $> 1$.
- **Affected Files:** `backend/llm_service.py`, `backend/main.py`
- **Effort:** 10 hours
- **Deliverable:** Stress test with 5 concurrent requests completes smoothly with sequential execution and zero load penalty.

### Task B.2: Semantic Distance Thresholding ($\epsilon$-Cutoff) (TSK-RAG-01)
- **Goal:** Cleanly reject out-of-domain inquiries before LLM synthesis.
- **Implementation:**
  1. Evaluate cosine distance distribution of retrieved top-$k$ chunks.
  2. If the minimum distance $D_{\text{cos}}(\hat{\mathbf{q}}, \hat{\mathbf{d}}_1) > 0.65$, short-circuit execution and return: *"I could not find relevant information in the available documents."*
- **Affected Files:** `backend/rag.py`
- **Effort:** 3 hours
- **Deliverable:** Queries on irrelevant topics (sports, entertainment) exit in $<50$\,ms without invoking the LLM.

---

## Phase C: Production Deployment & LAN Infrastructure (Week 3)
*Focus: Make the system accessible to any campus device without developer tools.*

### Task C.1: Reverse Proxy & LAN HTTPS (TSK-DEP-01)
- **Goal:** Eliminate client-side SSH port-forwarding commands.
- **Implementation:**
  1. Install Nginx on compute server node.
  2. Configure reverse proxy blocks:
     - `/` $\to$ Next.js Web UI (`localhost:3000`)
     - `/api/` $\to$ FastAPI Backend (`localhost:8000`)
     - WebSocket proxying for streaming chat responses.
  3. Generate institutional internal self-signed TLS certificates for local HTTPS.
- **Affected Files:** `/etc/nginx/sites-available/cgpt.conf`
- **Effort:** 6 hours
- **Deliverable:** Any student or faculty laptop on campus Wi-Fi accesses the portal by typing `https://10.241.143.89` directly in Chrome/Firefox.

### Task C.2: Systemd Daemonization (TSK-DEP-02)
- **Goal:** Auto-restart services on power failure or reboot.
- **Implementation:**
  1. Author `c-gpt-backend.service` to manage `uvicorn`.
  2. Author `c-gpt-frontend.service` to manage Next.js.
  3. Enable systemd linger and automatic restart on crash (`Restart=always`).
- **Affected Files:** `/etc/systemd/system/c-gpt-*.service`
- **Effort:** 3 hours
- **Deliverable:** Host machine reboot restores working application within 60 seconds with zero terminal input.

---

## Phase D: Automated Testing & Continuous Verification (Week 4)
*Focus: Ensure future changes cannot break existing capabilities.*

### Task D.1: Automated Pytest Suite (TSK-QA-01 & TSK-QA-02)
- **Goal:** Comprehensive end-to-end and unit test coverage.
- **Implementation:**
  1. Test authentication flows (registration, login, invalid credentials, token expiry).
  2. Test SQL engine with diverse table structures and adversarial inputs.
  3. Test RAG document chunking, indexing, and role filtering.
  4. Test upload endpoints with malformed CSVs, corrupted files, and valid documents.
- **Affected Files:** `tests/test_auth.py`, `tests/test_sql.py`, `tests/test_rag.py`, `tests/test_upload.py`
- **Effort:** 12 hours
- **Deliverable:** `pytest` runs in under 30s with 80%+ code coverage.

---

## Phase E: Data Governance, PII Masking & Disaster Recovery (Week 5)
*Focus: Institutional compliance and safeguarding student privacy.*

### Task E.1: Automated PII Masking (TSK-DAT-01)
- **Goal:** Prevent accidental storage of private student contact information.
- **Implementation:**
  1. In `backend/main.py` and `backend/load_structured.py`, scan incoming column names.
  2. Automatically mask or drop sensitive columns matching regex patterns: `(phone|mobile|aadhaar|pan|parent_contact|address)`.
- **Affected Files:** `backend/load_structured.py`, `backend/main.py`
- **Effort:** 4 hours
- **Deliverable:** Uploaded test roster with phone numbers replaces digits with `XXXXXX` before SQLite insert.

### Task E.2: Automated Disaster Recovery Cron (TSK-DAT-02)
- **Goal:** Zero data loss in case of hardware or disk failure.
- **Implementation:**
  1. Shell script creating timestamped gzip archives of `data/` and `structured_data/`.
  2. Daily Linux cron job at 02:00 AM retaining the last 7 daily snapshots.
- **Affected Files:** `scripts/backup.sh`, crontab entry
- **Effort:** 3 hours
- **Deliverable:** Verified full restoration of SQLite and ChromaDB from an automated backup archive.

---

## Phase F: Administrative Documentation & Pilot Rollout (Week 6)
*Focus: Transfer operations to departmental laboratory assistants and run pilot.*

### Task F.1: Administrator Runbook (TSK-DOC-01)
- **Goal:** Step-by-step procedures for non-technical institutional staff.
- **Deliverables:**
  - Emergency restart procedure.
  - Updating institutional policies (uploading next semester's circulars).
  - Monitoring GPU temperature and memory using `nvidia-smi`.
  - Adding new user accounts.
- **Effort:** 6 hours

### Task F.2: Departmental Pilot Review
- **Goal:** Controlled pilot trial with 25 CSE students and 5 faculty members.
- **Deliverable:** User feedback survey, hit rate statistics, and final mentor review sign-off.
- **Effort:** 10 hours

