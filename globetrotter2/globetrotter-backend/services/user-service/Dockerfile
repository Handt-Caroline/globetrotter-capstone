# =============================================================================
# Dockerfile - User Service
#
# Builds a small, self-contained image for JUST this service. Each of the
# 4 microservices + the gateway gets its own Dockerfile like this one, which
# is what "each service = its own process" means in Docker Compose terms:
# one container per service, each built from its own folder.
# =============================================================================

FROM python:3.12-slim

WORKDIR /app

# Copy only the dependency list first. Docker caches this layer, so
# `docker compose build` doesn't reinstall every package every time you
# change one line of Python - only when requirements.txt itself changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the actual application code.
COPY app ./app

# Where the JSON "database" file lives inside the container. We mount a
# Docker volume onto this path (see docker-compose.yml) so the data
# survives `docker compose down` / restarts instead of vanishing with the
# container.
RUN mkdir -p /app/data

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
