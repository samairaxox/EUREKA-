# EUREKA

EUREKA is an AI study assistant: summaries, quizzes, flashcards, practice tests, study planning, and
study material generated from your own PDF, plus focus sessions, a streak, and a profile that follows
you across devices.

This release adds real accounts (email/password and Google sign-in), PostgreSQL persistence, protected
per-user data, and a redesigned frontend. The AI-agent logic is unchanged.

## What's in the box

| Area | Where |
|---|---|
| FastAPI API (AI tools, auth, progress) | `main.py`, `auth_routes.py`, `progress_routes.py` |
| Authentication, tokens, rate limits | `security.py`, `deps.py`, `rate_limit.py` |
| Database models and migrations | `models.py`, `database.py`, `alembic/` |
| Streak calculation (server) | `streak_logic.py` |
| AI agents (unchanged) | `agents.py`, `eureka_graph.py`, `quiz_agent.py`, `flashcard_agent.py`, `rag_engine.py` |
| Backend tests (39) | `tests/` |
| React app | `study-frontend/src/` |
| React Bits components (official source, adapted where noted) | `study-frontend/src/reactbits/` (see `ADAPTATIONS.md`) |
| Frontend tests (25) | `study-frontend/src/` |

The Game Zone includes Answer Rush, Trivia Blast, Sequence Sprint, Logic Duel, Digital Escape Rooms,
Matching Pairs & Memory Grids, and Categorization Sorting. Best scores for supported games are stored
on the current device.

## Quick start (local)

Prerequisites: Python 3.12, Node.js 20+, PostgreSQL 16 (or Docker).

### 1. Configure the backend

```bash
cp .env.example .env
# Edit .env:
#   GROQ_API_KEY=...            (your existing key)
#   JWT_SECRET=...              python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 2. Start PostgreSQL

With Docker:

```bash
docker compose up -d db
```

Local development is restricted to the PostgreSQL database named `eureka_dev` on loopback port 5432. Set
`EUREKA_ENV=development` and `DATABASE_URL` in `.env`; `AUTO_MIGRATE=false` keeps startup from changing the schema.
The API rejects `eureka`, `eureka_test`, and other database names before creating its SQLAlchemy engine.

### 3. Install and migrate

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
```

### 4. Run the API

```bash
uvicorn main:app --reload --reload-exclude 'tests/**' --reload-exclude 'outputs/**' --reload-exclude 'work/**' --reload-exclude 'study-frontend/**' --reload-exclude 'node_modules/**' --reload-exclude '.venv/**' --reload-exclude '.pytest_cache/**' --reload-exclude '__pycache__/**' --reload-exclude '*.md' --reload-exclude '*.diff' --port 8000
```

On Windows PowerShell, start the same development server with `./run-dev.ps1`. The watcher excludes tests, generated outputs, frontend dependencies, virtual-environment files, caches, and documentation so editing those files does not restart the API. Python application files remain watched for hot reload.

### 5. Run the frontend

```bash
cd study-frontend
cp .env.example .env.local     # optional; defaults to http://localhost:8000
npm install
npm start                      # http://localhost:3000
```

Docker Compose can also run the API together with the database: `docker compose up --build`. Migrations run
automatically when the API container starts.

## Google sign-in

Google sign-in is wired end to end but needs your credentials. Until they are set, the sign-in page says it is
not configured and email/password works normally.

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add `http://localhost:3000` under *Authorized JavaScript origins* (and your production origin later).
3. Put the client ID in both places:
   - `.env` as `GOOGLE_CLIENT_ID=...` (the server checks the token's audience against it)
   - `study-frontend/.env.local` as `REACT_APP_GOOGLE_CLIENT_ID=...`
4. Restart the API and the frontend.

The server verifies every Google ID token's signature, issuer, audience, and expiry before trusting it, and
keys accounts on Google's stable `sub` identifier. An existing password account is linked to a Google identity
only when that account's email is already verified. Unverified local accounts are never linked automatically,
so a Google sign-in can't take over an account someone else registered with the same address.

## Security model

- **Passwords:** Argon2 hashes only. Passwords are never stored or logged in plain text. Unknown accounts take
  the same hashing time as wrong passwords.
- **Access tokens:** short-lived HS256 JWTs (15 minutes by default) held in memory by the browser. They are
  never written to `localStorage`.
- **Refresh tokens:** random 48-byte values, stored only as SHA-256 hashes, sent as an `HttpOnly` cookie scoped
  to `/auth` with `SameSite=Lax`. Each refresh rotates the token. Presenting a revoked token revokes the whole
  session family (reuse detection). Logout revokes the family immediately.
- **CSRF:** the refresh and logout endpoints require the `X-Requested-With: eureka` header, which browsers only
  send from an allowed origin after a CORS check.
- **CORS:** only the origins in `CORS_ORIGINS` are allowed, with credentials. Never use `*` in production.
- **Authorization:** every user-owned query is filtered by the user ID taken from the verified access token.
  The request body never chooses whose data is read. Uploaded PDF sessions are bound to the uploader; other
  users receive the same 404 as for an unknown session.
- **Rate limits:** per client IP, per minute: 10 for authentication, 30 for AI endpoints (both configurable).
- **Secrets:** all secrets live in environment variables. `.env` is gitignored. `.env.example` contains only
  placeholders.

## PDF processing and RAG

- PDF extraction uses PyMuPDF page by page. Empty pages are skipped while original 1-based page numbers and total
  page count are retained. Documents with too little selectable text return an OCR-required message; OCR is not
  installed. Password-protected, malformed, empty, and oversized PDFs receive a clear upload error.
- `/rag/upload` streams the upload to a temporary file, creates page-aware chunks, and indexes them with the existing
  local HuggingFace embedding model and FAISS. Chunks carry the document/session ID, user ID, filename, page, chunk
  index, page count, and upload timestamp. Identical uploads by the same user reuse the in-memory session.
- RAG sessions and vectors remain process-memory-only (as before); they expire after one hour by default and the
  server retains at most eight sessions. Restarting the API clears them. There is no cross-user retrieval path.
- Defaults in `.env.example`: 850-token chunks, 100-token overlap, conservative 3-characters-per-token estimate,
  2,400 context tokens, 700 reserved prompt tokens, 700 maximum output tokens, and one concurrent Groq request.
  All are configurable; the character estimate is a fallback, not an exact GPT tokenizer.
- Synchronous processing is bounded at 30 MB per PDF and 160 chunks per indexed document/summary by default.
  The PDF Study frontend allows up to five minutes for these longer requests; set `REACT_APP_LONG_AI_TIMEOUT_MS`
  to adjust that client timeout.
- Both PDF Planner entry points now use `/rag/upload` and the owned FAISS index. `/rag/plan` maps every indexed
  chunk into a page-aware topic outline, merges repeated topic titles, allocates the outline across the inclusive
  start-to-exam date range, and adds deliberate practice and final-review sessions. It returns the existing
  `study_plan` text field plus an additive structured `schedule` array with `day`, `date`, `task`, `duration`,
  `topics`, and source `pages`. The synchronous schedule is bounded to 120 dates by default (`RAG_PLAN_MAX_DAYS`).
- Typed-topic `/plan` remains available and generates date batches of at most seven rows. It validates that every
  inclusive requested date appears exactly once before returning any schedule.
- PDF summaries map across every indexed section and reduce the section summaries before returning the existing
  response key. Quiz and flashcard generation samples chunks across the document, validates the requested output
  format, and removes duplicate items. `/rag/ask` adds grounded question answering with page citations; existing
  `/rag/quiz`, `/rag/summarize`, `/rag/flashcards`, and `/rag/plan` paths remain in place.
- 413 responses shrink and retry the context; when a document-wide stage is shortened, the unsent tail is queued as
  another bounded section. 429 and transient errors use bounded retries, exponential backoff, jitter, and
  `Retry-After` when supplied. No raw document text or provider response bodies are written to logs.

## Study progress

- A **study day** is recorded when a completed action succeeds on the server: an AI generation, a quiz or
  practice test result, a daily trivia run, or a finished focus session. Opening a tool no longer counts as
  studying. This is a behaviour change from the previous version, which counted any tool opened.
- The **local calendar date** comes from the browser in an `X-Local-Date` header, so a study day matches the
  user's day, not the server's UTC day.
- **Streaks** are computed on the server. The current streak counts back from today, or from yesterday until
  today's activity is recorded.
- **Focus sessions** are recorded once per session key. A repeated submission returns the stored record. Sessions
  are checked for plausibility: duration must be 25, 45, or 60 minutes, the recorded span must match the duration,
  and a session can't complete in the future.
- **Progress percentage** is today's completed focus sessions against the daily session target the user sets.
  It is shown only with that denominator.
- **Quiz results** are self-reported by the user's own browser after a quiz, practice test, or daily trivia run.
  They are the user's own record, but they are not independently verified.

## Tests

```bash
# Backend (requires a PostgreSQL database named eureka_test; see tests/conftest.py)
pip install -r requirements-dev.txt
pytest -q

# Frontend
cd study-frontend
CI=true npm test -- --watchAll=false   # 14 tests
npm run build
```

Backend tests run against real PostgreSQL. The AI agent modules are replaced with deterministic stubs, so the
tests never call an external model. Migrations were verified with `alembic upgrade head`, `alembic downgrade base`,
and `alembic check` (no drift).

## Deployment

1. Serve the frontend and API over **HTTPS**.
2. Set in the API environment:
   - `COOKIE_SECURE=true`
   - `EUREKA_ENV=production`
   - `CORS_ORIGINS=https://your-frontend.example`
   - `JWT_SECRET` (48+ random characters, kept server-side)
   - `DATABASE_URL` pointing at managed PostgreSQL
   - `GOOGLE_CLIENT_ID` (once configured)
3. Build the frontend with `REACT_APP_API_URL=https://api.your-domain.example` and, if used,
   `REACT_APP_GOOGLE_CLIENT_ID`.
4. Run `alembic upgrade head` as a release step before starting new API instances.
5. Run a single API worker, or enforce rate limits at the reverse proxy. The built-in limiter keeps counters
   in process memory, so it is per worker, not global.

## React Bits

The 13 requested components are the official React Bits `src/content` source, copied into
`study-frontend/src/reactbits/` with their MIT + Commons Clause license. Where a component depended on a library
this project doesn't use, a small local shim replaces it. Every change is listed in
`study-frontend/src/reactbits/ADAPTATIONS.md`.

| Component | Used in | Status |
|---|---|---|
| Iridescence | Landing hero | Original; tuned props for the pastel palette |
| Fold Text | Landing section headings | Original |
| Animated Content | Landing scroll reveals | Original; visibility fallback after 4 s |
| Circular Carousel | Landing agent section | Original; agent artwork is generated SVG, not stock photos |
| Crosshair | Landing final CTA | Original; disabled on touch and reduced motion |
| Pixel Blast | Sign-in background | Original |
| Split Text | Greeting after sign-in | Original, via `WelcomeGreeting` |
| Thought Line | AI loading states | Adapted: `motion` replaced by a Web Animations shim; status shows only while a request is in flight |
| Branched Menu | Summarizer only | Adapted: icons replaced; options are real actions only |
| Grid Scan | Focus Mode | Original; camera and motion sensors disabled |
| Counter | Focus duration | Original |
| Magic Bento | Profile stat cards | Adapted: light theme; real icon package |
| Swipe Row | Notes list | Original; visible Archive and Delete buttons as the alternative |
| Spring Check | Checklist items | Original |
| Glitch Text | Focus Mode heading | Original; hover-triggered |
| Radar | Game entry screen | Original |
| Shape Grid | Shared site background; game screens; game loading | Original; one lint-only parenthesisation |
| Wake Slider | Not used | Interactive slider; the transitions are automatic, so a separate ProgressTransition is used instead |

The study-rhythm chart on the profile is custom SVG, because React Bits has no chart component in this list.

## Status

Implemented and checked in a headless browser against the live API and PostgreSQL:
- Public landing: transparent nav, split hero with a rotating final word, DriftWall feature wall, ChromaGrid of the six
  agents, Circular Carousel with detail sections, FoldText headings, LightTunnel focus showcase with CometDial and Counter,
  Crosshair final call to action. Checked at desktop and 390 px phone width.
- Sign-in with Pixel Blast, then a welcome screen ("Hello, <name>") that moves on automatically to the dashboard.
- Notes (Swipe Row, with keyboard-accessible action reveal) and checklists (Spring Check) saved to PostgreSQL, with
  ownership enforced by the API. Checked: create, edit, reload, archive, delete, toggle, and cross-user isolation.
- Summarizer: pasted notes and real PDF upload (extraction checked end to end); Thought Line while a request runs;
  Branched Menu offers result actions only after a summary exists.
- Focus Mode: Glitch Text heading, automatic entry transition, Counter countdown that starts after the transition, pause,
  resume, confirmed early exit, and one recorded completion.
- Game entry: Radar screen, then the selected game, over the shared Shape Grid background.
- Profile: Magic Bento statistic cards, study-rhythm chart (custom SVG), activity calendar, circular progress.

Not verified:
- The AI summary text (the sandbox cannot reach Groq). The error and retry path is verified.
- Touch swipe on a phone (checked with the mouse only; the visible buttons perform the same actions).
- Google sign-in with real credentials.

### Fix pass (latest)
- Dashboard: the default screen is now an overview built on Magic Bento, with real shortcuts to every tool and progress
  taken from the server (streaks, focus today, focus time, quiz average, study-rhythm chart, recent activity).
- Shape Grid is the shared background on the authenticated site, at visible opacity, with pointer events disabled.
- Focus Mode entry: heading sized to fit on one line (30 to 56 px), back link in its own corner, Grid Scan with stronger lines.
- Summarizer: Branched Menu colours passed as props (the component writes them inline), so the labels are readable.
- Sign-in: Pixel Blast uses stronger pixels on a lavender base.
- Welcome screen: shown for 7 seconds, once per signed-in session (a refresh goes straight to the destination).
- Games: the Radar entry runs for every game link, including links from the overview and direct URLs.

Limits of this pass: the headless browser used for checking renders at about 2 frames per second, so frame-to-frame
motion was confirmed as present but not judged for smoothness. Smooth motion must be checked on a real GPU browser.

## Known limitations

- **Google sign-in has not been tested with real Google credentials.** The token checks, identity linking, and error
  paths are covered by tests that use synthetic tokens.
- **The Summarizer and other AI tools need a reachable Groq API.** In the verification sandbox the Groq call failed,
  so a successful end-to-end summary was not observed. The UI shows the error correctly.
- **Email addresses are not verified** for password accounts (no email is sent). Google-created accounts are
  verified by Google.
- **PDF study sessions are held in server memory** and are lost when the API restarts.
- **Answer Rush is not recorded** in progress, because it scores points rather than correct answers.
- **Trivia availability** (one daily run) is still gated by browser storage.
- **Password reset and account deletion** are not implemented.
- **Rate limiting** is per process (see Deployment).
- **Not yet verified on phones.** Layouts were checked at desktop width only. Grid Scan and Iridescence are GPU-heavy
  and should be checked on mobile hardware.
- **Iridescence and Grid Scan use WebGL.** If WebGL is unavailable, the error boundary shows a static fallback, but
  the fallback is only triggered by an exception; a silent failure to create a context would show an empty area.
- **Fonts** (Playfair Display, Nunito) load from Google Fonts. Offline, the system serif is used instead.
- **License:** React Bits is MIT + Commons Clause, which prohibits selling software whose value comes substantially from
  the component. Check this before any commercial use.
