# Academic Mentor Review & Technical Explanation Guide
**Project:** Local College Intelligence ("C-GPT") — Offline Institutional AI for RVCE  
**Target Audience:** Academic Project Mentor & Faculty Reviewers (Specializing in Mathematics & Computer Science)  
**Document Purpose:** Mathematical formulation, foundational principles, assumptions, and specific areas where mentor guidance is requested.

---

## 1. Executive Summary for the Mathematics Faculty Mentor

Dear Professor,

This project addresses a practical challenge in institutional administration: **How can a college provide an intelligent, automated conversational assistant for student attendance, grades, and academic regulations while strictly ensuring that private records never leave our campus network?**

Instead of relying on commercial cloud artificial intelligence (such as ChatGPT), which exposes student records to third-party cloud servers and charges per-question fees, we designed and implemented a **100% offline, decentralized architecture** running on local campus hardware.

The system relies on two mathematical pathways:
1. **Relational Algebra Mapping (Ask Data):** Translating natural language questions into formal first-order predicate relational database queries ($\pi$ projection and $\sigma$ selection).
2. **Dense Vector Geometry & Set Filtering (Ask Docs):** Mapping academic policy documents into a continuous 384-dimensional Euclidean vector space $\mathbb{R}^{384}$, utilizing the cosine metric (inner product) for semantic retrieval, constrained by set-theoretic role filters.

Below, we detail the mathematical models underlying our implementation, the current development status, and specific questions where we seek your guidance.

---

## 2. Mathematical Foundations of the System

### 2.1 The Vector Space Model of Text ($\mathbb{R}^{384}$)
In classical computer science, search relied on Boolean keyword matching. If a student asked about *"minimum attendance to write exams"*, a system matching keywords would fail if the official policy document used the words *"eligibility criteria for Semester End Examination (SEE)"*.

To solve this, we map natural language sentences into an **abstract normed vector space**:
$$\Phi: \text{Text} \longrightarrow \mathbb{R}^{384}$$

Each clause in our institutional regulations becomes a single point (vector) in 384-dimensional space:
$$\mathbf{d} = (x_1, x_2, x_3, \dots, x_{384}) \in \mathbb{R}^{384}$$

The transformation $\Phi$ (computed using a deep Siamese neural network, `all-MiniLM-L6-v2`) has an extraordinary mathematical property: **sentences with similar semantic meanings are mapped to vectors pointing in nearly identical directions in $\mathbb{R}^{384}$.**

---

### 2.2 Normalization and the Cosine Inner Product
To eliminate the effect of text length (a 20-word paragraph should not have an artificially larger magnitude than a 5-word sentence), every vector is projected onto the **unit hypersphere** $\mathbb{S}^{383} \subset \mathbb{R}^{384}$ using the Euclidean $L_2$-norm:

$$\|\mathbf{v}\|_2 = \sqrt{\sum_{i=1}^{384} v_i^2}$$
$$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2} \implies \|\hat{\mathbf{v}}\|_2 = 1$$

When a user submits a query $q$, we normalize it to $\hat{\mathbf{q}}$. To find the most relevant document clauses, we compute the angle $\theta$ between the query vector $\hat{\mathbf{q}}$ and every document vector $\hat{\mathbf{d}}_i$.

By the **Cauchy-Schwarz theorem** and the definition of the dot product:
$$\hat{\mathbf{q}} \cdot \hat{\mathbf{d}}_i = \|\hat{\mathbf{q}}\|_2 \|\hat{\mathbf{d}}_i\|_2 \cos(\theta)$$

Since both vectors are normalized ($\|\hat{\mathbf{q}}\| = \|\hat{\mathbf{d}}_i\| = 1$), the cosine similarity simplifies directly to the algebraic inner product:
$$\cos(\theta) = \hat{\mathbf{q}} \cdot \hat{\mathbf{d}}_i = \sum_{j=1}^{384} \hat{q}_j \hat{d}_{i,j}$$

- If $\cos(\theta) = 1$ ($\theta = 0^\circ$): Identical semantic meaning.
- If $\cos(\theta) = 0$ ($\theta = 90^\circ$): Orthogonal (unrelated topic).
- If $\cos(\theta) = -1$ ($\theta = 180^\circ$): Diametrically opposite meaning.

The **Cosine Distance** metric used by our database is:
$$D_{\text{cos}}(\hat{\mathbf{q}}, \hat{\mathbf{d}}_i) = 1 - (\hat{\mathbf{q}} \cdot \hat{\mathbf{d}}_i)$$

---

### 2.3 Role Authorization as Set-Theoretic Partitioning
A major concern in college administration is **confidentiality**: students must not access faculty grading rubrics or disciplinary committee notices.

Commercial systems attempt to enforce this using "prompts" (e.g., telling the AI: *"Please do not reveal faculty notes to students"*). This is probabilistic and frequently fails ("prompt injection").

In our system, we formulate role authorization as a **rigorous set-theoretic filter**:
- Let $\mathcal{U} = \{d_1, d_2, \dots, d_M\}$ be the universal set of all document chunks.
- Let $\mathcal{R} = \{\text{student}, \text{faculty}, \text{hod}, \text{admin}\}$ be the set of possible roles.
- Each document chunk $d_i$ is assigned a non-empty subset of authorized roles: $\text{Access}(d_i) \subseteq \mathcal{R}$.

When a student ($r = \text{student}$) asks a question, the vector database partitions the search domain **before computing distances**:
$$\mathcal{U}_{\text{student}} = \{ d_i \in \mathcal{U} \mid \text{student} \in \text{Access}(d_i) \}$$

The nearest-neighbor optimization is performed strictly on $\mathcal{U}_{\text{student}}$:
$$\arg\min_{d_i \in \mathcal{U}_{\text{student}}} D_{\text{cos}}(\hat{\mathbf{q}}, \hat{\mathbf{d}}_i)$$

**Mathematical Guarantee:** The unauthorized set $\mathcal{U} \setminus \mathcal{U}_{\text{student}}$ has cardinality 0 in the candidate set. It is physically impossible for confidential text to reach the language model context window.

---

### 2.4 Relational Algebra and Text-to-SQL
For tabular data (attendance, CIE marks), natural language questions are converted into relational algebra expressions over relation $R$:
1. **Selection ($\sigma$):** $\sigma_{\text{attendance} < 75}(R)$ (filtering rows).
2. **Projection ($\pi$):** $\pi_{\text{usn, name, attendance}}(R)$ (selecting specific columns).
3. **Aggregation ($\gamma$):** $\gamma_{\text{AVG}(\text{marks})}(R)$ (computing averages).

To prevent accidental modification or malicious SQL injection, our backend applies an Abstract Syntax Tree (AST) gatekeeper that verifies the query is an element of the read-only relational operator set:
$$Q \in \Sigma_{\text{read-only}} \implies \text{Execution Permitted}$$
Any query containing mutations ($\text{DROP}, \text{DELETE}, \text{UPDATE}, \text{INSERT}$) is deterministically rejected before reaching the SQLite engine.

---

### 2.5 Latency Modeling & GPU Memory Persistence
Total user-perceived response time $T_{\text{total}}$ can be modeled as:
$$T_{\text{total}} = T_{\text{network}} + T_{\text{retrieval}} + T_{\text{load}} + T_{\text{generation}}$$

Where:
- $T_{\text{network}} \approx 0.015$\,s (over local campus Wi-Fi).
- $T_{\text{retrieval}} \approx 0.040$\,s (HNSW graph search over 100 chunks).
- $T_{\text{generation}} = N_{\text{tokens}} \times \tau_{\text{token}}$ ($\approx 50 \times 0.04$\,s $\approx 2.0$\,s).
- $T_{\text{load}}$: **The critical bottleneck.**

By default, the AI engine unloads the model from GPU RAM when idle. The first request after an idle period pays:
$$T_{\text{load}} \approx 6.33\text{ seconds to } 18.0\text{ seconds}$$

By configuring our backend with `keep_alive = -1`, the model weights remain locked in GPU VRAM permanently:
$$T_{\text{load}} \to 0.0007\text{ seconds}$$
This single optimization reduces the latency of subsequent questions by over $80\%$.

---

## 3. Current Project Progress: Reality vs. Plans

| Feature Area | Current Verified Status | Notes / Limitations |
|---|---|---|
| **RAG on College Regulations** | ✅ Implemented (11 synthetic docs) | 2022/2024 schemes, clubs, hostel, library, placement bylaws indexed. |
| **Ask Data (Text-to-SQL)** | ✅ Implemented | Works on single-table queries and simple joins with few-shot guidance. |
| **Local Offline LLM** | ✅ Implemented | Running Qwen2.5-Coder:7B on local GPU / Qwen3-4B on CPU via Ollama. |
| **Timing Badge in UI** | ✅ Implemented | UI displays `⏱ Xs` for every answer based on millisecond backend timers. |
| **Auto-load CSVs on Boot** | ✅ Implemented | `structured_data/` files automatically populate SQLite tables on startup. |
| **Role-Based Set Filter** | ✅ Implemented in DB query | ChromaDB applies `where={"role_<role>": True}` filter internally. |
| **Cryptographic JWT Token Auth** | ⚠️ Partial / Prototype | User role is selected in UI and passed in body; needs server-side JWT signatures. |
| **Multi-User Queue** | ⚠️ Prototype | Overlapping simultaneous requests currently serialize without priority queue. |
| **Real Institutional Datasets** | ⚠️ Synthetic | Tested on synthetic datasets to avoid exposing real student records before clearance. |

---

## 4. Key Questions Where We Request Mentor Guidance

We would deeply appreciate your feedback and advice on the following aspects:

1. **Distance Threshold Cutoff Formulation:**
   Currently, we retrieve the top $k=4$ nearest document chunks regardless of absolute distance. If a user asks an irrelevant question (e.g., *"How do I bake a cake?"*), the top 4 chunks might still have a high cosine distance (e.g., $D_{\text{cos}} \approx 0.85$). 
   *Question for Mentor:* Would you recommend establishing an empirical distance threshold $\epsilon$ such that chunks with $D_{\text{cos}}(\hat{\mathbf{q}}, \hat{\mathbf{d}}) > \epsilon$ are discarded before reaching the language model? What statistical distribution (e.g., Gaussian, Chebyshev bounds) would be appropriate to determine $\epsilon$?

2. **Chunk Size Trade-Off Optimization:**
   Currently, document chunks are capped at $L_{\text{max}} = 1000$ characters. A smaller chunk size provides tight semantic vectors but loses contextual narrative; a larger chunk preserves context but dilutes the vector direction in $\mathbb{R}^{384}$. 
   *Question for Mentor:* How should we design a rigorous experimental trial to evaluate chunk length ($L \in \{250, 500, 1000, 1500\}$) against retrieval precision?

3. **Multi-Table SQL Evaluation Metric:**
   For evaluating Text-to-SQL, is measuring exact string matching sufficient, or should we evaluate execution correctness (comparing the result sets of the generated SQL versus a ground-truth SQL query using Jaccard index or set equality)?

4. **Conference Venue Suitability:**
   Given the empirical baseline and mathematical structure, would this research draft be best suited for an IEEE regional conference (such as IEEE DISCOVER, IEEE CONECCT, or IEEE NKCON) under the tracks of *Applied AI in Education*, *Information Systems Security*, or *Edge Computing*?

---

*Prepared with respect for our Faculty Project Mentor by the C-GPT Student Engineering Team.*

