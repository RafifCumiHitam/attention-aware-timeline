.PHONY: up down build logs api ai web migrate revision shell-api shell-ai lint

# Development
up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

# Individual services
api:
	docker compose up api postgres redis --build

ai:
	docker compose up ai --build

web:
	docker compose up web --build

# Database
migrate:
	docker compose exec api alembic upgrade head

revision:
	docker compose exec api alembic revision --autogenerate -m "$(m)"

# Shells
shell-api:
	docker compose exec api bash

shell-ai:
	docker compose exec ai bash

# Lint (local)
lint-api:
	cd apps/api && ruff check . && mypy app

lint-ai:
	cd apps/ai && ruff check . && mypy app

lint-web:
	cd apps/web && npm run lint && npm run typecheck
