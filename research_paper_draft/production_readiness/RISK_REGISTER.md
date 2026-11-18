# Production Risk Register & Assessment
**Project:** Local College Intelligence ("C-GPT")  
**Risk Scoring Formula:** $\text{Severity} = \text{Likelihood} \times \text{Impact}$  
*(Likelihood: 1-Low, 2-Medium, 3-High | Impact: 1-Minor, 2-Moderate, 3-Critical | Severity: 1-3 Low, 4-5 Medium, 6-9 High)*

---

## 1. Master Risk Matrix

```
       Impact ──►  [1] Minor      [2] Moderate    [3] Critical
Likelihood:
  [3] High          RSK-04 (Med)   RSK-01 (High)   RSK-02 (High)
  [2] Medium        RSK-06 (Low)   RSK-05 (Med)    RSK-03 (High)
  [1] Low           RSK-09 (Low)   RSK-08 (Low)    RSK-07 (Med)
```

---

## 2. Detailed Risk Register

| Risk ID | Category | Risk Description | Likelihood | Impact | Severity | Mitigation Strategy | Residual Risk |
|---|---|---|:---:|:---:|:---:|---|---|
| **RSK-01** | Security / Auth | **Role Parameter Tampering:** Attacker crafts raw HTTP POST with modified `"role": "admin"`, retrieving restricted documents. | 3 | 2 | **6 (HIGH)** | Enforce server-side cryptographic JWT token verification; strip role from request payload. | Low (Standard JWT auth) |
| **RSK-02** | Security / DB | **SQL Injection via Adversarial Prompt:** Specially crafted prompt generates nested destructive SQL evading regex filter. | 2 | 3 | **6 (HIGH)** | Replace regex matching with `sqlparse` AST validator enforcing single read-only `SELECT` query. | Negligible (Enforced AST) |
| **RSK-03** | Reliability / Perf | **GPU VRAM Thrashing Under Concurrency:** Multiple simultaneous requests trigger competing model load operations. | 2 | 3 | **6 (HIGH)** | Integrate an asynchronous FIFO queue in `llm_service.py` to serialize LLM invocations. | Low (Brief queue wait) |
| **RSK-04** | Operational | **Server IP Churn on Reboot:** Departmental DHCP router assigns a new IP address to the server after power cut. | 3 | 2 | **6 (HIGH)** | Configure static IP binding in `/etc/netplan/` or reserve MAC address in campus router DHCP table. | Negligible |
| **RSK-05** | Accuracy | **Regulation Scheme Hallucination:** Model blends 2022 and 2024 bylaws when answer differs between schemes. | 2 | 2 | **4 (MED)** | System prompt enforces explicit scheme citation; inject separate scheme comparison examples. | Low |
| **RSK-06** | Usability | **Complex Multi-Table Query Failure:** Model fails to generate valid JOINs on tables with 3+ relational dependencies. | 2 | 2 | **4 (MED)** | Expand few-shot prompt with explicit multi-table JOIN templates; prompt user to clarify ambiguous queries. | Low (Fallback to guided view) |
| **RSK-07** | Data Loss | **Accidental Table Drop / Disk Corruption:** User drops SQLite table or storage media degrades without backup. | 1 | 3 | **3 (MED)** | Automated daily timestamped backup cron copying `data/` to secondary storage drive. | Negligible |
| **RSK-08** | Performance | **Edge Server Thermal Throttling:** Sustained LLM inference during peak hours overheats workstation GPU. | 1 | 2 | **2 (LOW)** | Monitor GPU temperature via `nvidia-smi`; enforce inference rate limits and idle cool-down intervals. | Low |
| **RSK-09** | Compliance | **Accidental PII Ingestion:** Department staff uploads student roster containing personal phone numbers. | 1 | 2 | **2 (LOW)** | Automated regex PII scrubbing during CSV intake; warn user before database commit. | Negligible |

