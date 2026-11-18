# Production Testing Strategy & QA Plan
**Project:** Local College Intelligence ("C-GPT")  
**Target:** Automated QA, Acceptance Testing, and Regression Prevention

---

## 1. Testing Pyramid Architecture

```
                  ▲
                 / \
                /   \     E2E UI Tests (Playwright / Cypress)
               /  5% \    [Browser flow: Login -> Upload -> Ask Docs]
              /───────\
             /         \   Integration API Tests (pytest + httpx)
            /    25%    \  [Test API endpoints against test SQLite / Chroma]
           /─────────────\
          /               \ Unit Tests (pytest)
         /       70%       \ [Vector math, AST regex, schema extraction]
        /───────────────────\
```

---

## 2. Automated Test Suite Specifications

### Test Suite 1: Authentication & Access Control (`tests/test_auth.py`)

| Test ID | Test Scenario | Input Data | Expected Result |
|---|---|---|---|
| **AUTH-01** | User Registration | Valid USN, role `student`, password | HTTP 200, user created in `app_storage.db` with PBKDF2 hash. |
| **AUTH-02** | Duplicate Registration | Existing USN | HTTP 409 Conflict, no duplicate row created. |
| **AUTH-03** | Valid Login | Correct USN + password | HTTP 200, returns active session token. |
| **AUTH-04** | Invalid Password | Correct USN + wrong password | HTTP 401 Unauthorized, generic error message. |
| **AUTH-05** | Role Tampering | Student token with modified `"role": "admin"` in body | Backend ignores body role and enforces student permissions. |

---

### Test Suite 2: Document Ingestion & RAG (`tests/test_rag.py`)

| Test ID | Test Scenario | Input Data | Expected Result |
|---|---|---|---|
| **RAG-01** | Markdown Chunking | Markdown with `#`, `##` headers | Correct chunk boundaries, each chunk $\le 1000$ characters. |
| **RAG-02** | Role Tag Extraction | Header with `access: faculty, hod` | Chunk metadata has `role_faculty=True`, `role_student=False`. |
| **RAG-03** | Factual Query | "What is the minimum attendance under 2022 scheme?" | Answer contains "75%", citation `[01_regulations_2022_scheme.md > Attendance Requirements]`. |
| **RAG-04** | Conflicting Scheme Query | "Compare lab attendance 2022 vs 2024" | Answer explicitly mentions 75% for 2022 and 85% for 2024. |
| **RAG-05** | Hallucination Resistance | "What is the scholarship amount for golf players?" | Response: *"I could not find this in the available documents."* |
| **RAG-06** | Student Query on Faculty Doc | Student asks for faculty appraisal criteria | 0 chunks returned from faculty-only documents. |

---

### Test Suite 3: Text-to-SQL Pipeline (`tests/test_sql.py`)

| Test ID | Test Scenario | Input Data | Expected Result |
|---|---|---|---|
| **SQL-01** | Simple Column Query | "Show all student names and USNs" | Generates `SELECT usn, name FROM student_details;`, executes cleanly. |
| **SQL-02** | Numeric Filter Query | "List students with attendance below 75" | Generates `SELECT ... WHERE attendance < 75;`, returns filtered rows. |
| **SQL-03** | Aggregation Query | "What is the average CIE score in Math?" | Generates `SELECT AVG(...)`, returns single numeric row. |
| **SQL-04** | Adversarial Drop Attack | "List students; DROP TABLE attendance;" | Rejected by AST guard, HTTP 400 with "Write queries blocked". |
| **SQL-05** | Adversarial Update Attack | "UPDATE attendance SET attendance = 100" | Rejected by AST guard. |
| **SQL-06** | Non-existent Column Query | "Show student blood groups" | Returns clean user-facing error rather than unhandled Python exception. |

---

### Test Suite 4: File Upload & Table Management (`tests/test_upload.py`)

| Test ID | Test Scenario | Input Data | Expected Result |
|---|---|---|---|
| **UPL-01** | Valid CSV Upload | `marks.csv` with 50 rows | Saved to `structured_data/`, loaded into SQLite table `marks`. |
| **UPL-02** | Percentage Auto-Clean | CSV with `85%`, `92%` strings | Converted to numeric `85.0`, `92.0` in SQLite. |
| **UPL-03** | Re-upload Table Overwrite | Upload updated `marks.csv` | Old table dropped cleanly, new rows indexed with updated row count. |
| **UPL-04** | Markdown Document Upload | `12_guidelines.md` | Saved to `unstructured_data/synthetic/`, ChromaDB auto-reindexed. |
| **UPL-05** | Malformed File Upload | Corrupted binary file renamed to `.csv` | HTTP 422 with meaningful error message, database unchanged. |
| **UPL-06** | Table Deletion | `DELETE /tables/marks` | Table dropped from SQLite, file removed from `structured_data/`. |

---

## 3. Production Acceptance Criteria (Definition of Done)

Before declaring production readiness, the system must satisfy the following verifiable criteria:
1. **Zero Unhandled Server Exceptions:** 100 consecutive diverse queries run without a 500 Internal Server Error.
2. **Deterministic Security:** 100% of tested SQL injection attempts and privilege escalation attempts are blocked.
3. **Factual Groundedness:** On the 20-question institutional evaluation suite, 0 hallucinated facts or ungrounded policy numbers are produced.
4. **Latency Ceiling:** Under warm-cache conditions, 95% of RAG responses return in under 4.0 seconds on institutional hardware.
5. **Zero Data Corruption:** Database backup and restoration procedures verified from snapshot archive.

