# Production Multi-Stage Dockerfile for FastAPI Gateway (services/api)
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project dependency declarations
COPY pyproject.toml uv.lock ./

# Install project dependencies into virtualenv
RUN uv venv /app/.venv && uv sync --frozen --no-dev

# Production runtime stage
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime libgomp for XGBoost/LightGBM
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root system user
RUN groupadd -g 1001 pyrosat && \
    useradd -u 1001 -g pyrosat -m -s /bin/bash appuser

# Copy virtualenv from builder
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Copy application source code
COPY --chown=appuser:pyrosat packages /app/packages
COPY --chown=appuser:pyrosat services /app/services
COPY --chown=appuser:pyrosat artifacts /app/artifacts
COPY --chown=appuser:pyrosat data /app/data
COPY --chown=appuser:pyrosat fixtures /app/fixtures
COPY --chown=appuser:pyrosat alembic /app/alembic
COPY --chown=appuser:pyrosat alembic.ini pyproject.toml /app/

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
