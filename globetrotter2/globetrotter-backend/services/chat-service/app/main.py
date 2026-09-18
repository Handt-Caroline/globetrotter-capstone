# =============================================================================
# main.py  -  CHAT SERVICE entry point
#
# Owns: chat rooms (1-on-1, group, and the one shared public room) and
# their messages. Real-time delivery is the WebSocket route (app/ws.py);
# REST (app/routers/rooms.py) handles room/membership management and
# loading history. Calls are signalling only - see app/chatlogic.py's
# start_call(): this service NEVER touches audio or video. The actual call
# happens in self-hosted Jitsi Meet (see docker-compose.yml), which the
# frontend joins directly once it hears "call_started" over the socket.
#
# Run it directly (for local dev, no Docker):
#   cd services/chat-service
#   pip install -r requirements.txt
#   uvicorn app.main:app --reload --port 8004
# =============================================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import metrics
from app.routers import rooms
from app.ws import router as ws_router

app = FastAPI(
    title="GlobeTrotter - Chat Service",
    description="Owns: chat rooms and messages (1-on-1, group, and the shared public "
    "room). Real-time over WebSocket. Calls are signalling-only - see app/chatlogic.py. "
    "Phase 2 microservice.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(ws_router)

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
    return {"status": "ok", "service": "chat-service", "phase": "Phase 2 - Microservices"}
