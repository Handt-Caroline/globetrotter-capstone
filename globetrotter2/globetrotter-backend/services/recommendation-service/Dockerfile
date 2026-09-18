# =============================================================================
# Dockerfile - Recommendation Service
#
# Notice there is no `mkdir -p /app/data` here, unlike the other services'
# Dockerfiles - this service has no database file to create, on purpose.
# =============================================================================

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
