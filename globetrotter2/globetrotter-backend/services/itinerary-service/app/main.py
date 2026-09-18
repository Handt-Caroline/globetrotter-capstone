# =============================================================================
# main.py  -  ITINERARY SERVICE entry point
#
# Owns: the destination catalogue, itineraries, favorites, the OpenRouteService
# routing proxy, and uploaded destination photos/videos. See app/storage.py
# for why destinations live here instead of a separate service.
#
# Run it directly (for local dev, no Docker):
#   cd services/itinerary-service
#   pip install -r requirements.txt
#   uvicorn app.main:app --reload --port 8002
# =============================================================================

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app import metrics, storage
from app.routers import assistant, destination_requests, destinations, favorites, itineraries, routing, social

app = FastAPI(
    title="GlobeTrotter - Itinerary Service",
    description="Owns: destinations, itineraries, favorites, routing. Phase 2 microservice.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registered BEFORE destinations.router - see the note at the top of
# destination_requests.py / routers/social.py about why the order here
# matters (both have a static path like "/requests" or "/top-rated" that
# destinations.router's catch-all GET /destinations/{destination_id}
# would otherwise swallow).
app.include_router(destination_requests.router)
app.include_router(social.router)
app.include_router(destinations.router)
app.include_router(favorites.router)
app.include_router(itineraries.router)
app.include_router(routing.router)
app.include_router(assistant.router)

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
    return {"status": "ok", "service": "itinerary-service", "phase": "Phase 2 - Microservices"}


@app.get("/media/{filename}")
def serve_media(filename: str):
    """Serves an uploaded destination photo/video. Same logic as the
    monolith's main.py: reject anything that looks like a path (e.g.
    "../../etc/passwd") so a request can't escape the uploads folder."""
    if filename != Path(filename).name:
        raise HTTPException(status_code=404, detail="Not found")
    file_path = storage.uploads_dir() / filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(file_path)
