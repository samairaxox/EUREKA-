
# EUREKA

### Your AI-powered study workspace

**Turn your study material into a structured, interactive learning
experience.**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![FAISS](https://img.shields.io/badge/FAISS-Vector_Search-0467DF)](https://github.com/facebookresearch/faiss)
:::

------------------------------------------------------------------------

EUREKA brings AI-assisted learning, document-grounded study tools,
planning, personal study organization, focus sessions, and gamified
practice into one application.

Upload a PDF or work with a typed topic, generate learning material,
plan your study sessions, and track supported progress from a unified
workspace.

## At a glance

  **Learn**                           Summaries, quizzes, flashcards,
                                      practice tests, and document Q&A

  **Plan**                            Topic-based and PDF-based study
                                      schedules

  **Organize**                        Personal notes and checklists

  **Focus**                           Timed focus sessions with recorded
                                      completion

  **Practice**                        A Game Zone with multiple
                                      interactive games

  **Track**                           Dashboard, study activity, streaks,
                                      and profile statistics
  -----------------------------------------------------------------------

## Product areas

  -----------------------------------------------------------------------
  Area                                Capabilities
  ----------------------------------- -----------------------------------
  **AI study tools**                  Summarization, quiz generation,
                                      flashcards, practice tests,
                                      document Q&A

  **PDF learning**                    Page-aware text extraction,
                                      chunking, embeddings, retrieval,
                                      cited answers

  **Study planner**                   Typed-topic schedules and
                                      PDF-derived topic schedules

  **Workspace**                       Notes and checklists with
                                      account-scoped persistence

  **Focus Mode**                      Countdown, pause/resume, early-exit
                                      confirmation, completed-session
                                      tracking

  **Game Zone**                       Answer Rush, Trivia Blast, Sequence
                                      Sprint, Logic Duel, Digital Escape
                                      Rooms, Matching Pairs / Memory
                                      Grids, Categorization Sorting

  **Dashboard & profile**             Study overview, focus statistics,
                                      quiz averages, activity calendar,
                                      study-rhythm chart
  -----------------------------------------------------------------------

> **Progress-storage note:** Best scores for supported games are stored
> on the current device. Not every game contributes to server-side study
> progress; see [Known limitations](#known-limitations).

------------------------------------------------------------------------

## Architecture

### System overview

``` mermaid
flowchart TB
    U["Student"] --> FE["React frontend"]
    FE <-->|"HTTP / JSON API"| API["FastAPI backend"]

    API --> AUTH["Authentication & authorization"]
    API --> WORK["Workspace & progress APIs"]
    API --> AI["AI agent workflows"]
    API --> RAG["PDF / RAG pipeline"]

    AUTH --> DB[("PostgreSQL")]
    WORK --> DB

    RAG --> EXTRACT["PyMuPDF extraction"]
    EXTRACT --> CHUNK["Page-aware text chunks"]
    CHUNK --> EMB["Hugging Face embeddings"]
    EMB --> FAISS[("FAISS index")]
    FAISS --> AI
    AI --> GROQ["Groq API"]

    API --> FE
```

The diagram shows the main logical components. It is not a deployment
topology. In the current implementation, PDF RAG sessions and FAISS
vectors are held in server memory rather than persisted in PostgreSQL.

### What happens when a learner uses EUREKA?

  -----------------------------------------------------------------------
  User action             Backend work            Data / service involved
  ----------------------- ----------------------- -----------------------
  Sign up or log in       Validate credentials    PostgreSQL, Argon2, JWT
                          and issue session       and refresh-token
                          tokens                  handling

  Save a note             Verify user identity    FastAPI, SQLAlchemy,
                          and persist the note    PostgreSQL

  Complete a focus        Validate and record the Progress API,
  session                 completion              PostgreSQL

  Upload a PDF            Extract text, chunk it, PyMuPDF, Hugging Face
                          create embeddings and   model, FAISS, server
                          index it                memory

  Ask a PDF question      Retrieve relevant       FAISS, AI workflow,
                          chunks and generate a   Groq API
                          grounded answer         

  Open the dashboard      Fetch supported         Progress API,
                          progress and activity   PostgreSQL
                          data                    
  -----------------------------------------------------------------------

## Technology stack

  -----------------------------------------------------------------------
  Layer                   Technology              Role in EUREKA
  ----------------------- ----------------------- -----------------------
  Frontend                React, JavaScript, CSS  User interface and
                                                  interactions

  Backend                 Python, FastAPI         REST APIs and
                                                  application logic

  ORM / database access   SQLAlchemy              Python models,
                                                  sessions, database
                                                  queries

  Relational database     PostgreSQL              Accounts and persistent
                                                  user/application
                                                  records

  Schema migrations       Alembic                 Versioned database
                                                  structure changes

  Password hashing        Argon2                  Password hash storage

  Access authentication   HS256 JWT               Short-lived access
                                                  tokens

  Refresh authentication  HttpOnly cookie +       Session renewal and
                          hashed refresh token    revocation
                          storage                 

  Document extraction     PyMuPDF                 PDF text extraction

  Embeddings              Hugging Face embedding  Text-to-vector
                          model                   conversion

  Vector search           FAISS                   Similarity search over
                                                  document chunks

  AI provider             Groq API integration    AI generation workflows

  Containers              Docker, Docker Compose  Repeatable
                                                  backend/database
                                                  environment
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## How PDF-based learning works

EUREKA uses a retrieval-augmented generation (RAG) workflow to ground
study tools in uploaded documents.

``` mermaid
flowchart TD
    A["Upload PDF"] --> B["FastAPI receives file"]
    B --> C["PyMuPDF extracts text page by page"]
    C --> D["Split text into page-aware chunks"]
    D --> E["Generate embeddings"]
    E --> F[("FAISS vector index")]
    G["Learner asks a question"] --> H["Embed / process query"]
    H --> I["Retrieve relevant chunks"]
    F --> I
    I --> J["AI workflow + Groq"]
    J --> K["Answer with page references"]
    K --> L["React displays response"]
```

### RAG pipeline components

  -----------------------------------------------------------------------
  Step                    Component               Purpose
  ----------------------- ----------------------- -----------------------
  1                       Upload endpoint         Receives the PDF and
                                                  associates it with the
                                                  uploading user

  2                       PyMuPDF                 Extracts selectable
                                                  text page by page

  3                       Chunking                Splits text while
                                                  retaining source-page
                                                  metadata

  4                       Embedding model         Converts text chunks
                                                  into vectors

  5                       FAISS                   Indexes vectors for
                                                  similarity search

  6                       Retrieval               Finds relevant chunks
                                                  for a learner's query

  7                       AI workflow             Uses retrieved context
                                                  to generate a response
  -----------------------------------------------------------------------

### Document-based endpoints

  Endpoint            Purpose
  ------------------- -----------------------------------------------------
  `/rag/ask`          Grounded question answering with page citations
  `/rag/quiz`         Quiz generation from indexed document content
  `/rag/summarize`    Document summarization
  `/rag/flashcards`   Flashcard generation
  `/rag/plan`         Study-plan generation from indexed document content

The PDF planner builds a topic outline from indexed chunks and
distributes topics across the inclusive requested date range. Its
structured schedule can include dates, tasks, durations, topics, and
source pages.

### Current RAG storage and limits

  -----------------------------------------------------------------------
  Item                                Current behavior
  ----------------------------------- -----------------------------------
  PDF text extraction                 Text-based; scanned PDFs may
                                      require OCR

  OCR                                 Not installed in the documented
                                      setup

  RAG session storage                 Server memory

  FAISS vector storage                Server memory

  API restart                         Clears in-memory RAG sessions and
                                      vectors

  Session lifetime                    Configurable; one-hour default is
                                      documented

  Session capacity                    Bounded; eight-session default is
                                      documented

  Upload / chunk / context limits     Configurable through environment
                                      settings
  -----------------------------------------------------------------------

**Important:** PostgreSQL does not currently persist the PDF sessions or
FAISS vectors. A durable document store and persistent vector-index
strategy would be a separate extension.

------------------------------------------------------------------------

## Backend structure

The backend is split into modules so that API routing, security,
database access, AI workflows, and progress logic do not all live in one
file.

  -----------------------------------------------------------------------
  File / directory                    Responsibility
  ----------------------------------- -----------------------------------
  `main.py`                           FastAPI application entry point and
                                      application routes

  `agents.py`                         AI-agent coordination

  `eureka_graph.py`                   Agent workflow graph

  `quiz_agent.py`                     Quiz-generation workflow

  `flashcard_agent.py`                Flashcard-generation workflow

  `rag_engine.py`                     PDF retrieval and RAG processing

  `auth_routes.py`                    Registration, login, refresh, and
                                      logout routes

  `progress_routes.py`                Progress and streak-related APIs

  `workspace_routes.py`               Notes and checklist APIs

  `security.py`                       Password hashing, token and
                                      security utilities

  `deps.py`                           Shared FastAPI dependencies,
                                      including authentication
                                      dependencies

  `rate_limit.py`                     Request rate limiting

  `database.py`                       SQLAlchemy engine, session and
                                      database configuration

  `database_safety.py`                Database safety checks

  `models.py`                         SQLAlchemy database models

  `streak_logic.py`                   Study-streak calculation

  `alembic/`                          Database migration configuration
                                      and revisions

  `tests/`                            Backend automated tests
  -----------------------------------------------------------------------

### Database and migrations

PostgreSQL stores persistent application data. SQLAlchemy provides the
Python interface to that database, while Alembic tracks changes to the
database schema.

``` mermaid
flowchart LR
    MODEL["SQLAlchemy models<br/>models.py"] --> GEN["Alembic migration<br/>revision --autogenerate"]
    GEN --> REVIEW["Review migration script"]
    REVIEW --> APPLY["alembic upgrade head"]
    APPLY --> DB[("PostgreSQL schema")]
```

  -----------------------------------------------------------------------
  Alembic item                        Purpose
  ----------------------------------- -----------------------------------
  `alembic/versions/`                 Versioned migration scripts

  `0001_initial_schema.py`            Initial schema migration

  `0002_notes_and_checklists.py`      Notes and checklist schema
                                      migration

  `env.py`                            Alembic environment and migration
                                      configuration

  `script.py.mako`                    Template used to generate migration
                                      scripts

  `alembic.ini`                       Alembic configuration
  -----------------------------------------------------------------------

Useful commands:

``` bash
# Generate a migration proposal from model changes
alembic revision --autogenerate -m "describe schema change"

# Apply pending migrations
alembic upgrade head

# Show current database revision
alembic current

# Show migration history
alembic history
```

Review autogenerated migrations before applying them. `upgrade head`
changes the configured database schema; use the correct database URL and
environment.

------------------------------------------------------------------------

## Data storage: what lives where?

Not all EUREKA data is stored in the same place.

  -----------------------------------------------------------------------
  Data                    Current storage         Persistence
  ----------------------- ----------------------- -----------------------
  User accounts           PostgreSQL              Persistent

  Notes                   PostgreSQL              Persistent

  Checklists              PostgreSQL              Persistent

  Focus-session records   PostgreSQL              Persistent

  Supported               PostgreSQL              Persistent
  study-progress records                          

  PDF RAG sessions        Backend process memory  Lost when API process
                                                  restarts

  FAISS vectors           Backend process memory  Lost when API process
                                                  restarts

  Best scores for         Browser/device storage  Device-local
  supported games                                 
  -----------------------------------------------------------------------

This separation matters: a feature can use the backend without
necessarily writing all of its data to PostgreSQL.

------------------------------------------------------------------------

## Authentication and security

  -----------------------------------------------------------------------
  Control                             Implementation described in this
                                      project
  ----------------------------------- -----------------------------------
  Password storage                    Argon2 password hashes; no
                                      plaintext password storage

  Access tokens                       Short-lived HS256 JWTs; held in
                                      frontend memory

  Refresh tokens                      Random values; server stores
                                      SHA-256 hashes

  Refresh cookie                      HttpOnly cookie scoped to `/auth`,
                                      with SameSite configuration

  Token rotation                      Refresh token rotates during
                                      refresh

  Reuse detection                     Reuse of a revoked token revokes
                                      the session family

  Logout                              Revokes the associated session
                                      family

  Google sign-in                      ID-token signature, issuer,
                                      audience and expiry validation

  Account isolation                   User-owned queries are scoped to
                                      authenticated user identity

  PDF ownership                       Sessions are associated with the
                                      uploader

  CORS                                Explicit configured origins; avoid
                                      `*` in production

  Rate limiting                       Configurable per-client limits;
                                      built-in counters are process-local

  Secrets                             Supplied through environment
                                      variables; real `.env` files are
                                      not committed
  -----------------------------------------------------------------------

These are application-level controls, not a substitute for a
deployment-specific security review.

### Google sign-in setup

Google sign-in is integrated but requires credentials supplied by the
developer. Email/password sign-in remains available when Google sign-in
is not configured.

1.  Create an OAuth client of type **Web application** in Google Cloud
    Console.
2.  Add the frontend origin (for local development,
    `http://localhost:3000`) to **Authorized JavaScript origins**.
3.  Set the client ID in:
    -   Backend `.env`: `GOOGLE_CLIENT_ID`
    -   Frontend environment: `REACT_APP_GOOGLE_CLIENT_ID`
4.  Restart the backend and frontend.

The real Google sign-in flow must be tested with your own OAuth
credentials.

------------------------------------------------------------------------

## Study progress and streaks

Study activity is recorded when supported actions complete successfully,
rather than when a user merely opens a tool.

  -----------------------------------------------------------------------
  Behavior                            How it works
  ----------------------------------- -----------------------------------
  Study-day date                      Browser sends the local date using
                                      `X-Local-Date`

  Streak calculation                  Performed by the backend

  Focus completion                    Recorded once per session key

  Session validation                  Duration and timestamps are checked

  Daily focus progress                Completed sessions compared with
                                      the user's daily target

  Quiz / practice results             Reported by the user's browser; not
                                      independently verified
  -----------------------------------------------------------------------

Documented study-day events include successful AI generation, quiz or
practice-test results, a daily trivia run, and a completed focus
session.

------------------------------------------------------------------------

## Run EUREKA locally

### Prerequisites

  Requirement   Version / note
  ------------- -----------------------------------
  Python        3.12
  Node.js       20+
  npm           Included with Node.js
  PostgreSQL    16, or Docker with Docker Compose

### 1. Clone the repository

``` bash
git clone https://github.com/shalakaparpattedar21/EUREKA.git
cd EUREKA
```

### 2. Create the backend environment file

macOS / Linux:

``` bash
cp .env.example .env
```

Windows PowerShell:

``` powershell
Copy-Item .env.example .env
```

Configure the values in `.env`. At minimum, provide the required AI
provider key, database connection string, and a strong JWT secret.

Generate a JWT secret:

``` bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Never commit `.env`.

### 3. Start PostgreSQL

Using the provided Compose database service:

``` bash
docker compose up -d db
```

The documented local-development configuration uses a PostgreSQL
database named `eureka_dev` on loopback port `5432`. Configure
`EUREKA_ENV=development` and `DATABASE_URL` in `.env`. The documented
development setup uses `AUTO_MIGRATE=false`.

### 4. Create a Python environment and install backend dependencies

macOS / Linux:

``` bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Windows PowerShell:

``` powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Apply database migrations

``` bash
alembic upgrade head
```

### 6. Start the backend

Cross-platform:

``` bash
uvicorn main:app --reload --port 8000
```

Windows PowerShell:

``` powershell
.\run-dev.ps1
```

Backend: - API: `http://localhost:8000` - Interactive API docs:
`http://localhost:8000/docs`

### 7. Install and start the frontend

Open a second terminal:

``` bash
cd study-frontend
npm install
npm start
```

The frontend runs at `http://localhost:3000`.

The frontend defaults to the local API at `http://localhost:8000`. To
override it, create the frontend environment file from
`study-frontend/.env.example` and configure `REACT_APP_API_URL`.

### Docker Compose option

The repository also includes a Compose setup for the API and PostgreSQL:

``` bash
docker compose up --build
```

Review the Compose environment values before using this outside local
development. In the documented container setup, migrations run when the
API container starts.

------------------------------------------------------------------------

## Environment variables

The repository provides two templates:

-   `.env.example` --- backend settings.
-   `study-frontend/.env.example` --- frontend settings.

Common configuration variables include:

  --------------------------------------------------------------------------------
  Variable                         Used by                 Purpose
  -------------------------------- ----------------------- -----------------------
  `GROQ_API_KEY`                   Backend                 Groq API access

  `JWT_SECRET`                     Backend                 Access-token signing
                                                           secret

  `DATABASE_URL`                   Backend                 PostgreSQL connection

  `EUREKA_ENV`                     Backend                 Environment mode

  `AUTO_MIGRATE`                   Backend                 Automatic migration
                                                           behavior

  `CORS_ORIGINS`                   Backend                 Allowed browser origins

  `GOOGLE_CLIENT_ID`               Backend                 Google token audience
                                                           validation

  `COOKIE_SECURE`                  Backend                 Secure-cookie setting

  `REACT_APP_API_URL`              Frontend                Backend API base URL

  `REACT_APP_GOOGLE_CLIENT_ID`     Frontend                Google sign-in client
                                                           ID

  `REACT_APP_LONG_AI_TIMEOUT_MS`   Frontend                Timeout for longer AI
                                                           requests
  --------------------------------------------------------------------------------

Refer to the example files for the full list and defaults. The table
above is not exhaustive.

------------------------------------------------------------------------

## Tests and verification

### Backend tests

Backend tests use PostgreSQL. Configure a dedicated test database named
`eureka_test` as described in `tests/conftest.py`.

``` bash
pip install -r requirements-dev.txt
pytest -q
```

The test setup uses deterministic AI-agent stubs so the tests do not
need to call an external AI provider.

> Use a dedicated test database. Never point test configuration at a
> development or production database.

### Frontend tests

Run from `study-frontend/`:

``` bash
CI=true npm test -- --watchAll=false
```

### Frontend production build

Run from `study-frontend/`:

``` bash
npm run build
```

Test counts and verification status can change as the project evolves.
Run the commands above to obtain the current results rather than relying
on a hardcoded count in this README.

------------------------------------------------------------------------

## Docker: local services

The project includes a `Dockerfile` and `docker-compose.yml`.

  -----------------------------------------------------------------------
  File / command                      Purpose
  ----------------------------------- -----------------------------------
  `Dockerfile`                        Defines how the backend image is
                                      built

  `docker-compose.yml`                Defines and connects the configured
                                      services

  `docker compose up -d db`           Starts the database service in the
                                      background

  `docker compose up --build`         Builds images and starts configured
                                      services

  `docker compose ps`                 Lists Compose services

  `docker compose logs -f`            Follows service logs

  `docker compose down`               Stops and removes containers and
                                      the Compose network
  -----------------------------------------------------------------------

Docker volumes may preserve database data after containers are removed.
Avoid `docker compose down -v` unless you intentionally want to remove
associated volumes and their data.

------------------------------------------------------------------------

## UI components and attribution

EUREKA uses React Bits components in `study-frontend/src/reactbits/`,
together with project-specific UI, CSS, SVG artwork, and motion effects.

The repository includes: - React Bits license and notice files. -
`study-frontend/src/reactbits/ADAPTATIONS.md`, documenting local
adaptations and shims.

Review the included license and notices before redistributing or using
third-party components commercially.

------------------------------------------------------------------------

## Known limitations

  -----------------------------------------------------------------------
  Area                                Current limitation
  ----------------------------------- -----------------------------------
  Google sign-in                      Real Google credentials are
                                      required for end-to-end
                                      verification

  AI generation                       Requires a reachable Groq API and
                                      valid credentials

  Email verification                  Password-based accounts do not
                                      currently have an
                                      email-verification flow

  Password recovery                   Password reset is not implemented

  Account deletion                    Account deletion is not implemented

  PDF sessions                        RAG sessions and FAISS vectors are
                                      held in memory and cleared when the
                                      API restarts

  OCR                                 Scanned PDFs without selectable
                                      text require OCR, which is not
                                      installed in the documented setup

  Game progress                       Answer Rush is not recorded in
                                      study progress; supported game best
                                      scores are device-local

  Trivia availability                 The one-run-per-day restriction is
                                      browser-storage-based

  Rate limiting                       Built-in rate-limit counters are
                                      process-local

  Mobile                              Touch interactions and GPU-heavy
                                      visual effects need testing on real
                                      mobile devices

  WebGL                               Iridescence and Grid Scan use
                                      WebGL; fallback behavior should be
                                      checked on target devices

  Fonts                               Playfair Display and Nunito load
                                      from Google Fonts; system serif
                                      fallbacks are used offline
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## Contributing

Contributions and suggestions are welcome.

1.  Fork the repository.
2.  Create a feature branch.
3.  Keep changes focused and include tests where practical.
4.  Update documentation when behavior or configuration changes.
5.  Open a pull request describing the change and how it was tested.

Before submitting, check that no `.env` files, credentials, personal
uploads, database dumps, or generated runtime data are included.

## License and third-party notices

Review the repository's license and third-party notices before reusing
or redistributing EUREKA. React Bits components have their own included
license terms; see `study-frontend/src/reactbits/` and its
`ADAPTATIONS.md`.

------------------------------------------------------------------------

::: {align="center"}
**EUREKA --- Learn with structure. Practice with purpose.**
:::
