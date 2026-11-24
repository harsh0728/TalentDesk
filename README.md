# TalentDesk — Recruitment Tracker + AI Assistant

A small full-stack recruitment application with a document-grounded RAG assistant and read-only AI tools for live recruitment data.

## Tech stack

- **Frontend:** React, Vite, Axios
- **Backend:** Node.js, Express, Mongoose, JWT
- **Database:** MongoDB (single-node replica set for Part A stage-history transactions)
- **RAG vector store:** Qdrant
- **Background ingestion:** BullMQ worker + Redis
- **LLM and embeddings:** Google Gemini (`gemini-2.5-flash` and `gemini-embedding-001`)
- **Document parsing:** `pdf-parse` for PDF and UTF-8 text extraction for TXT
- **Local orchestration:** Docker Compose

React/Node/MongoDB were selected because they match the existing CRUD implementation and allow the AI services to be added without introducing a second application stack. Qdrant stores embeddings and chunk metadata; Redis/BullMQ keeps document ingestion out of the request-response path.

## Features

### Part A — CRUD

- JWT login with Recruiter and Viewer roles
- Job and candidate CRUD
- Candidate search, stage/job filters and pagination
- Stage transitions with append-only `StageEvent` history saved in a MongoDB transaction
- Seed data: 3 jobs and 15 candidates

### Part B — AI assistant

- Recruiters can upload PDF and TXT files (10 MB maximum per file)
- Upload requests create a document record and enqueue ingestion; a separate worker extracts text, chunks it, creates Gemini embeddings and stores vectors in Qdrant
- Chunk metadata preserves the source filename and PDF page number (or TXT chunk number)
- Chat answers document questions using retrieved passages and returns source citations
- If relevant evidence is not found, the API returns an abstention rather than asking the model to answer from general knowledge
- Three predefined read-only Gemini tools query MongoDB: `count_candidates`, `list_candidates`, and `job_summary`
- Every tool checks the authenticated user's role internally; Recruiter and Viewer can read, and no AI tool writes data
- The LLM receives function declarations only; it cannot submit raw SQL or arbitrary MongoDB queries
- Knowledge base view shows queued, processing, ready and failed document states

## Architecture

```text
React UI
  |-- Jobs / Candidates ----------------------> Express API ------> MongoDB
  |-- AI Chat -------------------------------> Express /api/chat
  |                                               |-- Gemini function calling
  |                                               |      |-- count_candidates -> MongoDB
  |                                               |      |-- list_candidates  -> MongoDB
  |                                               |      `-- job_summary     -> MongoDB
  |                                               `-- Gemini query embedding -> Qdrant search
  |                                                      `-- retrieved chunks -> Gemini answer + citations
  `-- PDF/TXT upload -> Express /api/documents/upload -> MongoDB document record
                                                        `-> Redis / BullMQ queue
                                                               `-> Worker
                                                                    |-- extract + chunk
                                                                    |-- Gemini embeddings
                                                                    `-- Qdrant vector upsert
```

## Requirements

- Docker Desktop with Docker Compose
- A Gemini API key from Google AI Studio (free-tier availability and quotas depend on Google's current limits)

## Run the complete application

1. Extract the ZIP and open the project directory in a terminal.
2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Open `.env` and set `GEMINI_API_KEY` to your key. Do not commit `.env`.
4. Start all services:

   ```bash
   docker compose up --build
   ```

5. Open **http://localhost:5173**.

The one command starts MongoDB, Redis, Qdrant, the Express API, the document-ingestion worker and the React frontend. The API is at `http://localhost:5000/api`; Qdrant's dashboard/API is at `http://localhost:6333/dashboard`.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Recruiter | `recruiter@talentdesk.local` | `Recruiter123!` |
| Viewer | `viewer@talentdesk.local` | `Recruiter123!` |

The API container runs `npm run migrate` (Mongoose index synchronization) and then `npm run seed` on startup. The seed skips seeding if jobs already exist, so restarts preserve application data. For a manual run, execute `docker compose exec api npm run migrate` followed by `docker compose exec api npm run seed`. To reset the local database and uploaded documents, stop the stack and remove volumes with `docker compose down -v`, then start it again. This deletes local data.

## Try Part B

1. Sign in as Recruiter.
2. Open the **AI Assistant** button in the bottom-right corner.
3. Select **Knowledge base** and upload `sample-documents/hiring-policy.txt`.
4. Wait for its status to become `ready` (the worker processes it in the background).
5. Select **Chat** and ask: `What does the hiring policy say about notice-period buyouts?`
6. Verify that the answer includes a citation to `hiring-policy.txt` and a page/chunk reference.
7. Ask: `How many candidates are in Interviewed for the Python Developer job?`
8. Ask: `List selected candidates who can join within 30 days.`
9. Ask an unsupported question such as `What is our relocation reimbursement policy?` and verify that the assistant abstains.
10. Sign in as Viewer and confirm that chat and document reading work but upload/delete controls are unavailable.

## Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side Gemini API key; required for embeddings and chat |
| `GEMINI_MODEL` | Gemini chat model; defaults to `gemini-2.5-flash` |
| `RAG_SCORE_THRESHOLD` | Minimum Qdrant similarity score; defaults to `0.42` |
| `JWT_SECRET` | JWT signing secret; replace the local default |
| `JWT_EXPIRES_IN` | JWT lifetime; defaults to `1d` |

All Compose variables are listed in the root `.env.example`. For running the API and worker directly on your machine, see `server/.env.example` for local service defaults.

## API overview

### Existing CRUD APIs

- `POST /api/auth/login`
- `GET|POST /api/jobs`
- `GET|PUT|DELETE /api/jobs/:id`
- `GET|POST /api/candidates`
- `GET|PUT|DELETE /api/candidates/:id`
- `POST /api/candidates/:id/move-stage`
- `GET /api/candidates/:id/history`

### Part B APIs

- `POST /api/documents/upload` — Recruiter only; multipart form field: `file`
- `GET /api/documents` — authenticated users
- `DELETE /api/documents/:id` — Recruiter only
- `POST /api/chat` — authenticated users; JSON body: `{ "question": "..." }`

All endpoints are under `/api`. The chat endpoint returns `{ answer, sources, tool_results }`.

## Evaluation

See [`eval.md`](./eval.md) for 10 test questions, expected results and an `Actual bot answer` column. The actual column is marked pending until each test is run with a configured Gemini key; do not present expected answers as real model outputs.

## Useful commands

```bash
# Start the stack

docker compose up --build

# Follow API and worker logs

docker compose logs -f api worker

# Stop containers (preserve data)

docker compose down

# Stop and delete local MongoDB, Qdrant, Redis-upload volumes

docker compose down -v

# Seed manually inside the API container

docker compose exec api npm run seed
```

## Design decisions and limitations

- Ingestion runs in a separate BullMQ worker so uploads return quickly and document status can be tracked.
- Qdrant stores vectors plus source metadata. MongoDB stores document ownership, upload details and processing state.
- The RAG pipeline uses page-aware PDF extraction and chunk-level citations for TXT/PDF content. Scanned PDFs without an embedded text layer need OCR, which is not included.
- Tool functions are a fixed allowlist of three read-only operations. Each function independently validates the authenticated role and its arguments.
- The chat API performs server-side abstention when there are no retrieved passages and no database tool result. Similarity thresholds may need adjustment against the actual uploaded documents.
- This is an assignment/demo implementation, not a production multi-tenant recruitment system. Production hardening would include tenant-level data isolation, refresh-token/session management, file malware scanning, per-user upload quotas, stronger observability, automated tests, and deployment secrets management.

## What I would improve with more time

- Add automated integration tests for document upload/ingestion, citations, tool execution and Viewer/Recruiter access.
- Add streaming chat responses and richer conversation persistence.
- Add OCR for scanned PDFs, document versioning and re-indexing.
- Add tenant isolation and production-grade security/monitoring.
- Add a CI workflow and deploy the complete stack.
