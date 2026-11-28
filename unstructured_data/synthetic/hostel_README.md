# RVCE RAG Knowledge Pack — Hostel & Anti-Ragging

This package contains a compact, source-traceable knowledge base for the RVCE college assistant. All included factual content is taken from official RVCE sources.

## Contents
- `documents/rvce_hostel_facilities.md` — hostel overview and accommodation information from RVCE’s 2025–26 handbook.
- `documents/rvce_hostel_information_official_site.md` — hostel page claims and practical instructions, clearly marked as a separate official web source because it contains older/conflicting details.
- `documents/rvce_anti_ragging_rules.md` — current handbook anti-ragging rules and RVCE anti-ragging web-page information, with stale committee roster details excluded.
- `metadata/sources.json` — official source URLs, source dates/versions, and intended use.

## RAG ingestion notes
Use Markdown files in `documents/` as the corpus. Keep source metadata attached to chunks. Prefer 2025–26 handbook facts for hostel allocation, amenities, wardens, contacts, and policy. The legacy official hostel page is kept separate; where it differs, do not merge the claims or present its contact/allocation details as current. The official anti-ragging web page has a committee table dated 2017–19 and an awareness-week date from 2023; those time-sensitive entries are omitted from the factual corpus.

## Scope
Included: hostel facilities, hostel blocks/use/capacity/official contact references, anti-ragging definition, prohibitions, consequences, awareness and undertaking information.
Excluded as unrelated/noise: admissions, tuition fee schedules, general handbook chapters, unrelated project files and external non-RVCE factual sources. The attached hostel fee and KEA/COMEDK admission PDFs were not included because their main content is fee/admission process rather than RAG hostel/anti-ragging knowledge.

## Update caution
The handbook is the RVCE 2025–26 edition (published 28 Aug 2025). For live availability, current hostel allotment, changed contacts, and current anti-ragging committee membership, refer to RVCE directly; do not infer current status from historical handbook or archived webpage content.
