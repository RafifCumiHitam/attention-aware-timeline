# Architecture Overview

## Principles

1. **Clean Architecture** – Domain is independent of frameworks.
2. **Feature-based frontend** – UI, hooks, and API calls colocated per feature.
3. **Service separation** – Backend API and AI inference are independent services.
4. **Async first** – FastAPI + SQLAlchemy async + asyncpg.
5. **12-factor** – Config via environment, disposable processes, logs to stdout.

## Service Boundaries

| Service | Responsibility | Technology |
|---------|----------------|------------|
| `web` | UI, client-side state, webcam capture | Next.js 15 |
| `api` | Auth, business rules, persistence, orchestration | FastAPI |
| `ai` | Frame preprocessing, model inference, attention scores | FastAPI + PyTorch/MediaPipe |
| `postgres` | System of record | PostgreSQL 16 |
| `redis` | Cache, rate limiting, ephemeral session data | Redis 7 |

## Communication

- Browser → Web (HTTP)
- Browser → API (REST + WebSocket)
- Browser → AI (REST for single-frame analysis; optionally WebSocket later)
- API → AI (internal HTTP for batch or server-side analysis)
- API → Postgres / Redis

## Future Extensions

- Message queue (RabbitMQ / Kafka) for asynchronous attention processing
- Object storage for recorded session clips
- Observability stack (Prometheus, Grafana, OpenTelemetry)
