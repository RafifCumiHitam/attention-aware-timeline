# Attention-Aware Timeline

**Deep Learning-based Adaptive Learning Platform**

Production-ready monorepo scaffold for an adaptive learning system that uses computer vision (gaze, attention, focus estimation) to personalize learning timelines in real time.

> **Note:** This repository currently contains only the scaffold (folder structure, configs, Docker, skeletons). **No business logic has been implemented yet.**

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Monorepo Structure](#monorepo-structure)
4. [Architecture](#architecture)
5. [Naming Conventions](#naming-conventions)
6. [Environment Variables](#environment-variables)
7. [Docker Architecture](#docker-architecture)
8. [API Architecture](#api-architecture)
9. [Database Architecture](#database-architecture)
10. [Installation & Running](#installation--running)
11. [Development Workflow](#development-workflow)
12. [Next Steps](#next-steps)

---

## Overview

**Attention-Aware Timeline** combines:

- A modern **Next.js 15** frontend for the learning experience
- A **FastAPI** backend following **Clean Architecture**
- A dedicated **AI inference service** (PyTorch, MediaPipe, OpenCV, TFLite) for real-time attention / gaze analysis
- **PostgreSQL** as the system of record
- Full **Docker / Docker Compose** support for local and production deployment

---

## Tech Stack

| Layer            | Technologies                                                                 |
|------------------|------------------------------------------------------------------------------|
| **Frontend**     | Next.js 15 (App Router), TypeScript, TailwindCSS, Shadcn UI, Zustand, React Hook Form, Axios, Framer Motion |
| **Backend**      | FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Alembic, Pydantic v2, JWT       |
| **AI Service**   | Python, FastAPI, PyTorch, OpenCV, MediaPipe, TensorFlow Lite                 |
| **Database**     | PostgreSQL 16                                                                |
| **Caching**      | Redis 7                                                                      |
| **Deployment**   | Docker, Docker Compose, Nginx                                                |
| **Tooling**      | Ruff, MyPy, Pytest, ESLint, Prettier                                         |

---

## Monorepo Structure

```
attention-aware-timeline/
├── apps/
│   ├── web/                          # Next.js 15 frontend
│   │   ├── app/                      # App Router
│   │   │   ├── (auth)/               # Auth route group
│   │   │   ├── (dashboard)/          # Protected dashboard routes
│   │   │   ├── (marketing)/          # Public marketing pages
│   │   │   └── api/                  # Next.js API routes (if needed)
│   │   ├── components/
│   │   │   ├── ui/                   # Shadcn UI primitives
│   │   │   ├── layout/               # Layout components
│   │   │   └── shared/               # Shared presentational components
│   │   ├── features/                 # Feature-based modules
│   │   │   ├── auth/
│   │   │   ├── timeline/
│   │   │   ├── attention/
│   │   │   ├── session/
│   │   │   └── user/
│   │   ├── hooks/                    # Global custom hooks
│   │   ├── lib/                      # Utilities, API client, etc.
│   │   ├── stores/                   # Zustand stores
│   │   ├── types/                    # Shared TypeScript types
│   │   ├── styles/
│   │   └── public/
│   │
│   ├── api/                          # FastAPI backend
│   │   ├── app/
│   │   │   ├── core/                 # Config, security, logging
│   │   │   ├── domain/               # Entities, value objects, repo interfaces, exceptions
│   │   │   ├── application/          # Use cases, DTOs, application services
│   │   │   ├── infrastructure/       # DB models, repositories, auth, external clients
│   │   │   ├── presentation/         # API routers, schemas, middleware, dependencies
│   │   │   └── shared/               # Shared utils & constants
│   │   ├── alembic/                  # Database migrations
│   │   ├── tests/
│   │   └── scripts/
│   │
│   └── ai/                           # AI inference service
│       ├── app/
│       │   ├── core/
│       │   ├── domain/
│       │   ├── application/          # Attention, gaze, emotion, focus use cases
│       │   ├── infrastructure/       # Model loading, preprocessing, inference
│       │   ├── presentation/
│       │   └── shared/
│       ├── models/                   # Checkpoints, TFLite, MediaPipe assets
│       ├── configs/
│       ├── tests/
│       └── scripts/
│
├── packages/                         # Shared packages (future monorepo tooling)
│   ├── shared/
│   ├── ui/
│   └── config/
│
├── infra/
│   ├── docker/
│   │   ├── web/Dockerfile
│   │   ├── api/Dockerfile
│   │   ├── ai/Dockerfile
│   │   ├── postgres/
│   │   └── nginx/
│   └── k8s/                          # Future Kubernetes manifests
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── deployment/
│   └── guides/
│
├── scripts/                          # Utility scripts
├── docker-compose.yml                # Development
├── docker-compose.prod.yml           # Production
├── .env.example
├── .gitignore
└── README.md
```

### Feature-Based Structure (Frontend)

Each feature under `apps/web/features/<feature>/` contains:

- `components/` – Feature-specific UI
- `hooks/` – Feature-specific hooks
- `api/` – Feature API calls

This keeps domain logic colocated and prevents the classic “components/” dumping ground.

---

## Architecture

### Clean Architecture (Backend & AI Service)

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│          (FastAPI routers, schemas, middleware)              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Application Layer                         │
│         (Use Cases, DTOs, Application Services)              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       Domain Layer                           │
│   (Entities, Value Objects, Repository Interfaces, Exceptions)│
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                  Infrastructure Layer                        │
│  (SQLAlchemy models, repository implementations, external    │
│   services, auth providers, model loaders, preprocessing)    │
└─────────────────────────────────────────────────────────────┘
```

**Dependency rule:** Outer layers depend on inner layers. Domain has zero external dependencies.

### High-Level System Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  Next.js Web │────▶│  FastAPI API │
│  (Webcam)    │     │   (Port 3000)│     │  (Port 8000) │
└──────────────┘     └──────────────┘     └──────┬───────┘
       │                                          │
       │ frames / WebSocket                       │
       ▼                                          ▼
┌──────────────┐                          ┌──────────────┐
│  AI Service  │◀─────────────────────────│  PostgreSQL  │
│  (Port 8001) │                          │  + Redis     │
└──────────────┘                          └──────────────┘
```

---

## Naming Conventions

| Context              | Convention                          | Example                          |
|----------------------|-------------------------------------|----------------------------------|
| Python packages      | `snake_case`                        | `use_cases`, `value_objects`     |
| Python classes       | `PascalCase`                        | `UserEntity`, `AttentionService` |
| Python functions     | `snake_case`                        | `get_user_by_id`                 |
| TypeScript files     | `kebab-case` or `camelCase`         | `auth-store.ts`, `apiClient.ts`  |
| React components     | `PascalCase`                        | `TimelineCard.tsx`               |
| Hooks                | `use` + `PascalCase`                | `useAuth`, `useTimeline`         |
| API routes (backend) | plural nouns                        | `/users`, `/attention`           |
| DB tables            | `snake_case`, plural                | `users`, `learning_sessions`     |
| Env variables        | `SCREAMING_SNAKE_CASE`              | `JWT_SECRET_KEY`                 |
| Docker services      | short lowercase                     | `api`, `ai`, `web`, `postgres`   |

---

## Environment Variables

Copy `.env.example` → `.env` and adjust values.

Key groups:

- **General** – `ENVIRONMENT`, `LOG_LEVEL`
- **Frontend** – `NEXT_PUBLIC_*`
- **Backend** – Database, JWT, CORS
- **AI Service** – Device (`cpu`/`cuda`), model paths, thresholds
- **Redis** – Caching / rate limiting
- **Feature flags** – Toggle attention, gaze, emotion, websockets

See `.env.example` for the full list with defaults.

---

## Docker Architecture

### Development (`docker-compose.yml`)

| Service   | Image / Build              | Ports     | Role                          |
|-----------|----------------------------|-----------|-------------------------------|
| `postgres`| `postgres:16-alpine`       | 5432      | Primary database              |
| `redis`   | `redis:7-alpine`           | 6379      | Cache / sessions              |
| `api`     | `infra/docker/api` (dev)   | 8000      | FastAPI backend               |
| `ai`      | `infra/docker/ai` (dev)    | 8001      | Inference service             |
| `web`     | `infra/docker/web` (dev)   | 3000      | Next.js frontend              |

Volumes mount source code for hot-reload. Health checks ensure startup order.

### Production (`docker-compose.prod.yml`)

- Multi-stage builds (`target: production`)
- Non-root users
- Nginx reverse proxy (ports 80/443)
- No source-code volume mounts
- Stricter environment (`ENVIRONMENT=production`)

---

## API Architecture

### Backend (`/api/v1`)

| Prefix          | Tag            | Purpose                              |
|-----------------|----------------|--------------------------------------|
| `/health`       | Health         | Liveness & readiness probes          |
| `/auth`         | Authentication | Login, register, refresh, logout     |
| `/users`        | Users          | Profile, preferences                 |
| `/sessions`     | Sessions       | Learning sessions CRUD               |
| `/timeline`     | Timeline       | Adaptive timeline items & ordering   |
| `/attention`    | Attention      | Attention metrics, history           |

### AI Service (`/api/v1`)

| Prefix          | Tag            | Purpose                              |
|-----------------|----------------|--------------------------------------|
| `/health`       | Health         | Liveness & model readiness           |
| `/attention`    | Attention      | Frame / stream analysis endpoints    |

All routers are already wired; endpoints are placeholders ready for implementation.

---

## Database Architecture

- **ORM:** SQLAlchemy 2.0 (async with `asyncpg`)
- **Migrations:** Alembic (async-aware `env.py`)
- **Base:** `apps/api/app/infrastructure/database/base.py`
- **Models location:** `apps/api/app/infrastructure/database/models/`
- **Repository pattern:** Domain defines interfaces; infrastructure implements them

Suggested core tables (to be implemented later):

- `users`
- `learning_sessions`
- `timeline_items`
- `attention_metrics`
- `gaze_samples`
- `refresh_tokens`

Extensions enabled on first start: `uuid-ossp`, `pgcrypto`.

---

## Installation & Running

### Prerequisites

- Docker & Docker Compose v2+
- (Optional for local non-Docker work) Node.js 22+, Python 3.12+, npm

### Quick Start (Docker – recommended)

```bash
# 1. Enter the project
cd attention-aware-timeline

# 2. Create environment file
cp .env.example .env
# Edit .env – especially JWT_SECRET_KEY and POSTGRES_PASSWORD

# 3. Start the full stack
docker compose up --build

# Services will be available at:
#   Frontend:  http://localhost:3000
#   API docs:  http://localhost:8000/docs
#   AI docs:   http://localhost:8001/docs
```

### Running Individual Services Locally

**Backend**

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
# Ensure DATABASE_URL points to a running Postgres
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**AI Service**

```bash
cd apps/ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

**Frontend**

```bash
cd apps/web
npm install
npm run dev
```

### Database Migrations

```bash
# Inside the api container or with local venv
cd apps/api
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

---

## Development Workflow

1. **Feature branch** → implement domain → use-case → infrastructure → presentation (in that order).
2. Keep business logic out of routers and models; put it in use cases.
3. Frontend: add feature under `features/<name>/` rather than scattering files.
4. Run linters:
   - Backend / AI: `ruff check .` / `mypy .`
   - Frontend: `npm run lint` / `npm run typecheck`
5. Add tests under `tests/` (Pytest) or co-located frontend tests.

---

## Next Steps

1. Implement domain entities & repository interfaces.
2. Create SQLAlchemy models + first Alembic migration.
3. Implement JWT authentication use cases & endpoints.
4. Wire MediaPipe / PyTorch models in the AI service.
5. Build the attention-aware timeline UI with Framer Motion + Shadcn.
6. Add WebSocket support for real-time attention feedback.
7. Introduce observability (OpenTelemetry / Sentry).
8. CI/CD pipelines and Kubernetes manifests under `infra/k8s`.

---

## License

Proprietary – All rights reserved.

---

Built for adaptive, attention-aware learning experiences.
