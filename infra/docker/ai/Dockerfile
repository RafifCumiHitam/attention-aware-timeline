# =============================================================================
# AI Service - Multi-stage Dockerfile (PyTorch + MediaPipe + OpenCV)
# =============================================================================

# -----------------------------------------------------------------------------
# Base Stage
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# Development Stage
# -----------------------------------------------------------------------------
FROM base AS development

COPY apps/ai/requirements.txt apps/ai/requirements-dev.txt ./
RUN pip install -r requirements.txt -r requirements-dev.txt

COPY apps/ai/ .

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

# -----------------------------------------------------------------------------
# Production Builder Stage
# -----------------------------------------------------------------------------
FROM base AS builder

COPY apps/ai/requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt

# -----------------------------------------------------------------------------
# Production Runtime Stage
# -----------------------------------------------------------------------------
FROM base AS production

COPY --from=builder /install /usr/local
COPY apps/ai/ .

RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
