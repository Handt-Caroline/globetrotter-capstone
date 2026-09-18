# =============================================================================
# Dockerfile - Itinerary Service
# =============================================================================

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# data/itinerary_db.json and data/uploads/ - mounted as a volume so uploaded
# photos and trip data survive container restarts (see docker-compose.yml).
RUN mkdir -p /app/data/uploads

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
