#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application with ${WORKERS:-1} workers..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${WORKERS:-1}" \
    --log-level "${LOG_LEVEL:-info}"
