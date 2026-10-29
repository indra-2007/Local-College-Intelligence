"""
ingest.py - Build the document index for RAG.

Pipeline:
  .md files -> parse front-matter -> split by headings -> work out who may read
  each chunk -> embed (sentence-transformers, local) -> store in ChromaDB

Usage (run from the repo root, venv active):
  python backend/ingest.py                      # (re)build the index
  python backend/ingest.py "your question" student   # quick search test as a role
"""

import os
import re
import sys

# ─── Config ──────────────────────────────────────────────────────────────────

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS_DIR = os.path.join(ROOT, "unstructured_data", "synthetic")
CHROMA_DIR = os.path.join(ROOT, "data", "chroma")
COLLECTION = "institutional_docs"
EMBED_MODEL = "all-MiniLM-L6-v2"
ROLES = ["student", "faculty", "hod", "admin"]
MAX_CHUNK_CHARS = 1000  # sections longer than this are split on blank lines


# ─── Parsing ─────────────────────────────────────────────────────────────────

def parse_front_matter(text: str):
    """Split a '---' YAML-ish header off the top. Returns (meta dict, body)."""
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip()
    return meta, parts[2]


def parse_roles(access: str):
    """'student, faculty, hod' -> ['student','faculty','hod']. Unknown words are dropped."""
    found = [r.strip().lower() for r in access.split(",")]
    return [r for r in found if r in ROLES]


def split_long(text: str):
    """Split an oversized section on blank lines into pieces <= MAX_CHUNK_CHARS."""
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]
    pieces, current = [], ""
    for para in text.split("\n\n"):
        if current and len(current) + len(para) > MAX_CHUNK_CHARS:
            pieces.append(current.strip())
            current = ""
        current += para + "\n\n"
    if current.strip():
        pieces.append(current.strip())
    return pieces


def chunk_document(path: str):
    """Return a list of chunk dicts for one .md file."""
    with open(path, encoding="utf-8") as f:
        meta, body = parse_front_matter(f.read())

    filename = os.path.basename(path)
    doc_title = meta.get("title", filename)
    file_roles = parse_roles(meta.get("access", ""))

    # Walk line by line, starting a new section at every #, ## or ### heading.
    sections = []  # (h2, h3, [lines])
    h2 = h3 = ""
    lines = []

    def flush():
        if lines:
            sections.append((h2, h3, list(lines)))

    for line in body.splitlines():
        m = re.match(r"^(#{1,3})\s+(.*)$", line)
        if m:
            flush()
            lines.clear()
            level, title = len(m.group(1)), m.group(2).strip()
            if level == 1:
                h2 = h3 = ""
            elif level == 2:
                h2, h3 = title, ""
            else:
                h3 = title
        else:
            lines.append(line)
    flush()

    chunks = []
    for h2, h3, sec_lines in sections:
        # Drop blockquote boilerplate ("> SYNTHETIC DOCUMENT ...").
        content = "\n".join(l for l in sec_lines if not l.lstrip().startswith(">")).strip()

        # A notice can carry its own '- access: ...' line; it overrides the file header.
        roles = file_roles
        m = re.search(r"^-\s*access:\s*(.+)$", content, re.MULTILINE | re.IGNORECASE)
        if m:
            roles = parse_roles(m.group(1))
            content = re.sub(r"^-\s*access:.*$\n?", "", content, flags=re.MULTILINE | re.IGNORECASE).strip()

        if not content:
            continue  # heading with no text of its own (children get their own chunks)

        breadcrumb = " > ".join(p for p in (h2, h3) if p) or doc_title
        for piece in split_long(content):
            chunks.append({
                "text": f"{doc_title} | {breadcrumb}\n{piece}",
                "metadata": {
                    "source": filename,
                    "section": breadcrumb,
                    "title": doc_title,
                    "doc_type": meta.get("doc_type", ""),
                    "scheme": meta.get("scheme", ""),
                    "effective_date": meta.get("effective_date", ""),
                    "status": meta.get("status", ""),
                    # One boolean per role: Chroma filters on these directly.
                    **{f"role_{r}": (r in roles) for r in ROLES},
                },
                "roles": roles,
            })
    return chunks


# ─── Index build and search ──────────────────────────────────────────────────

def build_index():
    import chromadb
    from sentence_transformers import SentenceTransformer

    files = sorted(f for f in os.listdir(DOCS_DIR) if f.endswith(".md"))
    if not files:
        sys.exit(f"No .md files found in {DOCS_DIR}")

    all_chunks = []
    for fname in files:
        all_chunks.extend(chunk_document(os.path.join(DOCS_DIR, fname)))

    # Fail closed: a chunk nobody may read is almost always a typo in an access line.
    for c in all_chunks:
        if not c["roles"]:
            print(f"WARNING: no valid roles for {c['metadata']['source']} / {c['metadata']['section']} (nobody can retrieve it)")

    print(f"Embedding {len(all_chunks)} chunks with {EMBED_MODEL} ...")
    model = SentenceTransformer(EMBED_MODEL)
    vectors = model.encode([c["text"] for c in all_chunks], normalize_embeddings=True).tolist()

    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    try:
        client.delete_collection(COLLECTION)  # rebuild from scratch each run
    except Exception:
        pass
    col = client.create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})
    col.add(
        ids=[f"{c['metadata']['source']}::{i}" for i, c in enumerate(all_chunks)],
        documents=[c["text"] for c in all_chunks],
        embeddings=vectors,
        metadatas=[c["metadata"] for c in all_chunks],
    )

    print(f"\nStored {col.count()} chunks in {CHROMA_DIR}\n")
    for c in all_chunks:
        m = c["metadata"]
        print(f"  {m['source'][:30]:30} | {m['section'][:45]:45} | {','.join(c['roles']) or 'NOBODY'}")


def search(question: str, role: str, k: int = 3):
    import chromadb
    from sentence_transformers import SentenceTransformer

    if role not in ROLES:
        sys.exit(f"role must be one of {ROLES}")
    model = SentenceTransformer(EMBED_MODEL)
    col = chromadb.PersistentClient(path=CHROMA_DIR).get_collection(COLLECTION)
    qvec = model.encode([question], normalize_embeddings=True).tolist()

    # The role filter runs INSIDE the database query, before any text comes back.
    res = col.query(query_embeddings=qvec, n_results=k, where={f"role_{role}": True})
    print(f'\nTop {k} for role={role}: "{question}"\n')
    for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        print(f"[{dist:.3f}] {meta['source']} > {meta['section']}")
        print("   " + doc.split("\n", 1)[1][:150].replace("\n", " ") + " ...\n")


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        search(sys.argv[1], sys.argv[2])
    else:
        build_index()
