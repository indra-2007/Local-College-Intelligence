# Production Readiness Go / No-Go Checklist
**Project:** Local College Intelligence ("C-GPT")  
**Threshold for Production Release:** 100% of MANDATORY items must be verified PASS.

---

## 1. Security & Access Control Checklist

| Check ID | Verification Item | Status | Verification Method |
|---|---|:---:|---|
| **CHK-SEC-01** | **[MANDATORY]** Role derived strictly from verified JWT session token, not client request body. | ❌ PENDING | Code audit in `backend/main.py`. |
| **CHK-SEC-02** | **[MANDATORY]** Formal SQL AST parser strictly blocks write/mutation operations (`DROP, UPDATE, etc.`). | ❌ PENDING | Fuzzing test with 25 injection strings. |
| **CHK-SEC-03** | **[MANDATORY]** Passwords hashed using PBKDF2-SHA256 with random salts and constant-time verification. | ✅ **PASS** | Verified in `backend/auth_storage.py`. |
| **CHK-SEC-04** | **[MANDATORY]** Pre-retrieval role filtering active in ChromaDB vector queries (`where={"role_<role>": True}`). | ✅ **PASS** | Verified in `backend/rag.py`. |
| **CHK-SEC-05** | **[MANDATORY]** API rate limiting configured to prevent Denial of Service on edge GPU. | ❌ PENDING | `slowapi` rate limiter test. |
| **CHK-SEC-06** | **[MANDATORY]** File uploads capped at 50MB with sanitized filenames and safe extension checking. | ⚠️ PARTIAL | Extension checked; file size cap needed. |
| **CHK-SEC-07** | **[MANDATORY]** Zero exposure of SQLite `.db` files or `.env` credentials in version control. | ✅ **PASS** | Verified in `.gitignore`. |

---

## 2. Infrastructure & Reliability Checklist

| Check ID | Verification Item | Status | Verification Method |
|---|---|:---:|---|
| **CHK-INF-01** | **[MANDATORY]** System services auto-start on server boot via systemd. | ❌ PENDING | Reboot host and verify curl responds within 60s. |
| **CHK-INF-02** | **[MANDATORY]** Persistent GPU VRAM retention active (`keep_alive: -1`) to avoid model reload lags. | ✅ **PASS** | Verified in `backend/llm_service.py`. |
| **CHK-INF-03** | **[MANDATORY]** In-process FIFO request queue serializing overlapping queries to prevent VRAM collision. | ❌ PENDING | Concurrency test with 5 simultaneous requests. |
| **CHK-INF-04** | **[MANDATORY]** Automated daily database snapshot script active with 7-day retention. | ❌ PENDING | Verify `data/backups/` contains valid `.tar.gz`. |
| **CHK-INF-05** | **[MANDATORY]** WSL/Host gateway IP auto-resolved dynamically without hardcoded IPs. | ✅ **PASS** | Verified in `backend/config.py`. |

---

## 3. Accuracy & Groundedness Checklist

| Check ID | Verification Item | Status | Verification Method |
|---|---|:---:|---|
| **CHK-ACC-01** | **[MANDATORY]** Strict `/no_think` prefix and citation instruction enforced on all policy inquiries. | ✅ **PASS** | Verified in `backend/rag.py`. |
| **CHK-ACC-02** | **[MANDATORY]** Unanswerable policy inquiries return standard rejection without fabricating rules. | ✅ **PASS** | Verified in Week 0 benchmark log. |
| **CHK-ACC-03** | **[MANDATORY]** Auto-clean percentages (`85%` $\to$ `85.0`) on CSV intake for accurate SQL comparisons. | ✅ **PASS** | Verified in `backend/main.py`. |
| **CHK-ACC-04** | Semantic distance threshold ($\epsilon$-cutoff) active to discard irrelevant context. | ❌ PENDING | Out-of-domain query evaluation test. |

---

## 4. Current Scorecard Summary

```
Total Mandatory Items:  14
Passed:                  8 (57.1%)
Pending / In-Progress:   6 (42.9%)

CURRENT PRODUCTION DECISION: [NO-GO]
Reason: 2 Critical Security Tasks (JWT Role Derivation & SQL AST Validator) 
        and 1 Infrastructure Task (FIFO Request Queue) must be completed.
```

