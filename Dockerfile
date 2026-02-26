# # Backend Dockerfile (API + Worker only)
# FROM python:3.12-slim-bookworm AS builder

# # Install uv
# COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# # Install system build deps
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     && rm -rf /var/lib/apt/lists/*

# ENV MAKEFLAGS="-j$(nproc)"
# ENV PYTHONDONTWRITEBYTECODE=1
# ENV PYTHONUNBUFFERED=1
# ENV UV_COMPILE_BYTECODE=1
# ENV UV_LINK_MODE=copy
# ENV PYTHONIOENCODING=utf-8

# WORKDIR /app

# # Install deps
# COPY pyproject.toml uv.lock ./
# COPY open_notebook/__init__.py ./open_notebook/__init__.py

# # Clear any existing uv cache and sync dependencies
# RUN uv cache clean && uv sync --frozen --no-dev --no-install-project

# # Copy source (excluding files via .dockerignore)
# COPY . .

# # Final sync with project
# RUN uv sync --frozen --no-dev

# # Runtime stage
# FROM python:3.12-slim-bookworm AS runtime

# # Runtime deps (ffmpeg, supervisor, Node.js for auth-api)
# RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
#     ffmpeg \
#     supervisor \
#     curl \
#     && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
#     && apt-get install -y --no-install-recommends nodejs \
#     && rm -rf /var/lib/apt/lists/*

# COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# WORKDIR /app

# # Copy venv and source
# COPY --from=builder /app/.venv /app/.venv
# COPY . /app

# # Install auth-api dependencies
# WORKDIR /app/auth-api
# RUN npm install --production --omit=dev
# WORKDIR /app

# ENV UV_NO_SYNC=1
# ENV VIRTUAL_ENV=/app/.venv

# # Expose API port and auth-api port
# EXPOSE 15055 4000

# RUN mkdir -p /app/data
# RUN mkdir -p /var/log/supervisor

# # Use backend-specific supervisor config
# COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
# =========================
# Builder Stage
# =========================
FROM python:3.12-slim-bookworm AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# System build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml uv.lock ./
COPY open_notebook/__init__.py ./open_notebook/__init__.py

RUN uv cache clean && uv sync --frozen --no-dev --no-install-project

# Copy full project
COPY . .

# Final dependency sync
RUN uv sync --frozen --no-dev


# =========================
# Runtime Stage
# =========================
FROM python:3.12-slim-bookworm AS runtime

# Runtime system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    supervisor \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy uv binary
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy virtual environment and project
COPY --from=builder /app/.venv /app/.venv
COPY . /app

# Install auth-api dependencies
WORKDIR /app/auth-api
RUN npm ci --only=production
WORKDIR /app

# Environment setup
ENV VIRTUAL_ENV=/app/.venv
ENV UV_NO_SYNC=1
ENV PATH="/app/.venv/bin:$PATH"

# Cloud Run requires listening on $PORT
ENV PORT=8080

# Do NOT expose fixed ports (Cloud Run ignores EXPOSE anyway)
EXPOSE 8080

# Create required runtime directories (ephemeral)
RUN mkdir -p /app/data /var/log/supervisor

# Copy supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
