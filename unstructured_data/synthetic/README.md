# C-GPT | RVCE sample Markdown corpus

This is a prototype knowledge base, not an official RVCE publication. `knowledge/` contains source-derived summaries and course/handbook text extracts. `synthetic/` contains fictional records and notices. `evaluation/` contains held-out questions with expected answers; do not index it.

## Ingestion
- Ingest only knowledge/ initially. Keep synthetic fixtures in a separate demo collection and enforce access before retrieval; YAML metadata does not enforce permissions by itself.
- Parse YAML front matter into metadata; retain filename, document ID, source, academic year, provenance and access scope on every chunk.
- Split at Markdown headings; preserve complete table rows with column headers. For prose try 400–600 tokens with 60–100 overlap and tune empirically.
- Prefer authoritative source-derived documents over demo fixtures. Return source document IDs and abstain on missing or conflicting information.
- Duplicate circular uploads checked by hash and represented once. Initial passwords omitted. PDF extracts retain source page markers but tables and equations may lose formatting. No actual student records, confirmed live deadlines or live placement availability supplied.
- No RAG implementation was run or verified; metadata keys are suggested and may need mapping to your loader.
