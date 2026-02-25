# Backend Dockerfile (API + Worker only)
FROM python:3.12-slim-bookworm AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV MAKEFLAGS="-j$(nproc)"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

# Install deps
COPY pyproject.toml ./

COPY open_notebook/__init__.py ./open_notebook/__init__.py
RUN uv sync --no-dev --no-install-project

# Copy source
COPY . /app
RUN uv sync --no-dev

# Runtime stage
FROM python:3.12-slim-bookworm AS runtime

# Runtime deps (ffmpeg, supervisor)
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    ffmpeg \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy venv and source
COPY --from=builder /app/.venv /app/.venv
COPY . /app

ENV UV_NO_SYNC=1
ENV VIRTUAL_ENV=/app/.venv

# Expose API port
EXPOSE 15055

RUN mkdir -p /app/data
RUN mkdir -p /var/log/supervisor

# Use backend-specific supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
