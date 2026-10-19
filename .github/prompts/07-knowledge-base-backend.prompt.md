---
mode: agent
description: Phase 07 - Knowledge base backend: folders, upload, ingestion, RAG search
---
# Phase 07 — Knowledge Base Backend
Read: docs/16-knowledge-base-rag.md (authoritative), docs/13-database-design.md (section 6), docs/06-security-rules.md (items 16-18), docs/14-rbac-accounts-organizations.md.

## Task
1. Providers: `storage` (S3/MinIO, presigned PUT/GET), `embedding` (interface + one adapter selected by env, batched), `web-search` (interface + Tavily adapter), optional `ocr` (interface + no-op default). Each returns usage info for metering.
2. Modules under `modules/knowledge`: `folders` (CRUD, move with cycle check, materialized path, soft delete + trash/restore), `documents` (presign upload, complete, URL import, list/filter/sort with cursor pagination, detail, chunks list, download signed URL, reprocess, versions, tags, soft delete), `access` (access_grants CRUD + effective access resolver used by all queries).
3. Ingestion: BullMQ queue `ingestion` + `worker.ts` processor: validate MIME by magic bytes → optional ClamAV → parse (parsers for pdf, docx, xlsx/csv, pptx, html/url, md/txt) → chunk (500–800 tokens, 80 overlap, keep page/section) → embed → write `document_chunks` (with denormalized owner/org/folder) → status updates + `ingestion_jobs` rows → notification `DOC_READY/DOC_FAILED` + SSE event.
4. Retrieval `retrieval/hybrid.ts`: access-filtered vector + keyword search inside SQL, Reciprocal Rank Fusion, optional rerank hook; return chunks with doc info and scores.
5. Answer `answer/rag.ts`: build prompt per docs/16 (cite `[n]`, "not found" rule, injection defense), stream via SSE `POST /v1/knowledge/search` with events `status, sources, chunks, token, citations, done`; modes: `web` (merge web results as WEB citations), `thinking` (reasoning model setting), `deep` (`deep-search.ts`: decompose → iterate ≤ `DEEP_MAX_STEPS` → structured report, emit step progress events).
6. Persist conversations/messages/citations; meter usage (EMBED, LLM_IN/OUT, WEB_SEARCH) through the usage module hook; enforce STORAGE_BYTES/DOCUMENT_COUNT quotas before upload (use stub until Phase 11, but call the same interface).
7. Endpoints exactly as listed in docs/16.

## Tests
Parsers on sample fixtures (vi/ja/en), chunker boundaries, hybrid search with fake embeddings, **cross-tenant leak test** (user B/org B never gets A's chunks via search, list, download, chunks endpoint), SSE event order, quota rejection.

## Definition of Done
Upload five mixed files → READY; a Vietnamese question about a Japanese document returns a Vietnamese answer with correct citations/pages; deleting a document removes it from search immediately; all tests pass.
