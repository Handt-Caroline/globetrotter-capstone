# =============================================================================
# main.py  -  USER SERVICE entry point
#
# This is a SEPARATE, INDEPENDENT process from Itinerary/Recommendation/Chat
# Service. It has its own port, its own FastAPI app, and its own data file
# (data/user_db.json). Nothing outside this folder can import from it -
# every other service that wants user data must go through its HTTP API
# (see app/routers/users.py and app/routers/preferences.py).
#
# Run it directly (for local dev, no Docker):
#   cd services/user-service
#   pip install -r requirements.txt
#   uvicorn app.main:app --reload --port 8001
#
# In Docker Compose this same command runs inside its own container - see
# ../../docker-compose.yml and this folder's Dockerfile.
# =============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import metrics
from app.routers import auth, preferences, users

app = FastAPI(
    title="GlobeTrotter - User Service",
    description="Owns: users, authentication (JWT), travel preferences. Phase 2 microservice.",
    version="2.0.0",
)

# CORS is wide open here too, same reasoning as the monolith: this is a
# class project running on localhost/one VM, not a public product. In this
# split architecture the browser normally never reaches this service
# directly anyway (it only talks to the API Gateway) - CORS mostly matters
# for hitting this service's own /docs page directly during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(preferences.router)
app.include_router(users.router)

app.middleware("http")(metrics.metrics_middleware)


@app.get("/metrics")
def get_metrics():
    return metrics.snapshot()


@app.post("/metrics/reset")
def reset_metrics():
    metrics.reset()
    return {"status": "reset"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "user-service", "phase": "Phase 2 - Microservices"}
