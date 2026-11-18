# C-GPT Research Paper Draft (IEEE Conference Format)

This folder contains the complete academic research paper draft, mathematical documentation, figures, and production readiness audit for **Local College Intelligence ("C-GPT")**.

---

## 📁 Folder Contents

```
research_paper_draft/
├── main.tex                    # Complete IEEE conference LaTeX paper source (~5-7 pages)
├── references.bib              # Verified, authentic IEEE bibliography
├── figures/                    # Vector TikZ and mathematical diagram illustrations
│   ├── system_architecture.tex # Overall system architecture diagram
│   ├── workflow_pipeline.tex   # Dual-stream (SQL + RAG) processing workflow
│   └── math_vector_rag.tex     # High-dimensional vector space & role set filtering
├── PROJECT_PROGRESS.md         # Exact breakdown of Implemented vs Partial vs Proposed
├── MENTOR_REVIEW.md            # Special review guide for Mathematics & CS Faculty Mentors
├── README.md                   # This instruction guide
└── production_readiness/       # Complete 9-part production readiness assessment & roadmap
    ├── PRODUCTION_AUDIT.md
    ├── PENDING_TASKS.md
    ├── DEVELOPMENT_ROADMAP.md
    ├── SECURITY_AUDIT.md
    ├── TESTING_STRATEGY.md
    ├── DEPLOYMENT_PLAN.md
    ├── RISK_REGISTER.md
    ├── PRODUCTION_CHECKLIST.md
    └── ARCHITECTURE_RECOMMENDATIONS.md
```

---

## 🛠️ How to Compile `main.tex` into PDF

### Method 1: Overleaf (Recommended — Zero Setup)
1. Go to [Overleaf.com](https://www.overleaf.com/) and create a free account.
2. Click **New Project** → **Upload Project**.
3. Zip this `research_paper_draft` folder and upload it, or simply create a new blank project, copy the contents of `main.tex` and `references.bib`, and create a `figures/` subfolder with the three `.tex` files.
4. Select compiler: **pdfLaTeX** or **XeLaTeX**.
5. Click **Recompile** → Download `paper.pdf`.

### Method 2: Local Command Line (TeX Live / MacTeX / MiKTeX)
From this directory:
```bash
# First pass
pdflatex main.tex

# Compile citations
bibtex main

# Second and third passes to resolve cross-references and figure numbers
pdflatex main.tex
pdflatex main.tex
```

### Method 3: VS Code (LaTeX Workshop Extension)
1. Install the **LaTeX Workshop** extension in VS Code.
2. Open `research_paper_draft/main.tex`.
3. Press `Ctrl + Alt + B` (Windows) or `Cmd + Option + B` (Mac) to build the PDF.

---

## 🎓 Tailored for Faculty Mentor Review

This draft has been written to bridge practical engineering with formal mathematical modeling:
- **Vector Space Embedding:** Rigorous representation in $\mathbb{R}^{384}$.
- **Inner Product Formulation:** Cosine similarity on an $L_2$-normalized unit hypersphere.
- **Role-Based Access Control:** Set-theoretic partitioning prior to nearest-neighbor search.
- **Relational Algebra Security Gate:** Deterministic AST filtering enforcing read-only projection/selection operators.
- **Empirical Hardware Benchmarks:** Real measurements from local testbeds (Ollama vs llama.cpp, thinking vs non-thinking speedup, cold vs warm cache latencies).

