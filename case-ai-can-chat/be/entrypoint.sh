#!/bin/bash
set -e

# Suppress Python warnings
export PYTHONWARNINGS="ignore::DeprecationWarning"

echo "=========================================="
echo "Note: Database initialization happens automatically on startup"
echo "=========================================="

# Start the FastAPI application
# Database initialization is handled by main.py lifespan function
exec uvicorn main:app --host 0.0.0.0 --port 8000