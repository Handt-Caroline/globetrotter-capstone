# =============================================================================
# Dockerfile - API Gateway
#
# BACKEND-REPO VERSION: this image is API-only and does not build or bake
# in the React frontend (that lives in a separate repo now). The Gateway's
# app/main.py already handles a missing FRONTEND_DIST gracefully - routes
# other than the known API paths just return a small "frontend not built"
# JSON note instead of the app shell - so nothing else about the app needs
# to change. Deploy the frontend repo separately (its own static host, or
# `npm run dev`) and point it at wherever this Gateway ends up running;
# CORS is already open (allow_origins=["*"]) in app/main.py.
#
# Build context is just this folder (services/gateway/), same as every
# other service - see docker-compose.yml.
# =============================================================================

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
