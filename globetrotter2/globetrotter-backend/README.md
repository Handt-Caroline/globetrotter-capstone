# GlobeTrotter Backend (Phase 2: Microservices + Chat)

This is the **backend-only** half of the GlobeTrotter project, split out
so it can live in its own repo and run independently of the frontend.
The React frontend is a separate repo — see the note at the bottom.

```
.
├── services/
│   ├── user-service/            owns: users, auth (JWT), preferences
│   ├── itinerary-service/       owns: destinations, itineraries, favorites,
│   │                            routing proxy, media uploads, ratings/
│   │                            comments/likes, the free AI assistant
│   ├── recommendation-service/  owns NO data - calls the two services
│   │                            above over real HTTP
│   ├── chat-service/            owns: chat rooms + messages (1-on-1, group,
│   │                            the shared public room). Real-time over
│   │                            WebSocket. Calls start signalled here are
│   │                            joined in self-hosted Jitsi, below.
│   └── gateway/                 the ONLY service any client (browser,
│                                frontend app) ever talks to. Routes
│                                everything, proxies the chat WebSocket.
│                                API-only in this repo (see below).
├── jitsi-config/                self-hosted Jitsi's own runtime state
│                                (created empty; Jitsi fills it in)
├── docker-compose.yml           run everything with one command
├── .env.example                 copy to .env and fill in - see below
└── scripts/
    └── load_test.py
```

### Architecture at a glance

```
   Client (frontend repo, Postman, etc.)
      │
      ▼
 ┌─────────┐   REST + WebSocket, ALWAYS - a client never talks
 │ Gateway │   to any service below directly. Enforced by Docker
 │  :8000  │   Compose network config, not just convention.
 └────┬────┘
      │  routes by path
      ├──────────────┬──────────────┬──────────────┐
      ▼              ▼              ▼              ▼
 ┌─────────┐   ┌─────────────┐  ┌──────────────┐ ┌──────────┐
 │  User   │   │  Itinerary  │  │Recommendation│ │   Chat   │
 │ Service │◄──┤   Service   │  │   Service    │ │ Service  │
 │  :8001  │   │    :8002    │  │    :8003     │ │  :8004   │
 └─────────┘   └─────────────┘  │ owns NO data,│ └────┬─────┘
                     ▲           │ calls the two│      │ "call started,
                     └───────────┤ services over│      │  here's the
                                 │  real HTTP   │      │  Jitsi room"
                                 └──────────────┘      ▼
                                              ┌───────────────────┐
                                              │ Self-hosted Jitsi │
                                              │  (its own 4       │
                                              │  containers - see │
                                              │  docker-compose)  │
                                              └───────────────────┘
```

## About the frontend split

This repo used to build the React frontend directly into the Gateway's
Docker image (a multi-stage build that needed `frontend/` as a sibling
folder). That coupling has been removed so this repo builds and runs on
its own:

- The Gateway's `Dockerfile` is now a plain single-stage Python image —
  it no longer builds or bakes in any frontend files.
- `app/main.py` already handled a missing frontend build gracefully
  before this split (this was existing code, not a new change): any
  route that isn't one of the known API paths just returns a small
  `{"note": "Frontend not built yet..."}` JSON response instead of the
  app shell. The API itself is unaffected.
- CORS is wide open (`allow_origins=["*"]`) in the Gateway, so the
  frontend — wherever it's deployed (its own static host, `npm run dev`,
  etc.) — can call this API cross-origin with no extra config. Just
  point it at this Gateway's URL (`http://localhost:8000` locally).

If you ever want the Gateway to serve the built frontend again from a
single origin, drop a built `frontend/dist` folder into the Gateway
container/image and set `FRONTEND_DIST` to its path — `app/main.py`
picks it up automatically.

## Run it with Docker Compose (recommended)

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `GLOBETROTTER_JWT_SECRET` - any long random string (`openssl rand -hex 32`)
- `JICOFO_COMPONENT_SECRET`, `JICOFO_AUTH_PASSWORD`, `JVB_AUTH_PASSWORD` - three
  **different** random strings (`openssl rand -hex 16` each) - see `.env.example`
  for what these are (Jitsi's own internal pieces authenticating to each other,
  nothing a traveller ever sees)
- everything else in `.env.example` has a working default or is optional

Then:

```bash
docker compose up --build
```

First run pulls/builds everything (the 4 backend services, the Gateway,
and Jitsi's 4 images). Once it settles, the API is at
**http://localhost:8000** (root path returns the "frontend not built"
note — try `http://localhost:8000/docs` for the interactive API docs
instead). `docker compose down` stops everything; add `-v` to also wipe
the JSON "databases" and Jitsi's config and start completely fresh.

**Who's an admin?** Whoever's email is in `ADMIN_EMAILS` in `.env` -
register or log in with that address and you have admin rights.

## Run it without Docker (one terminal per service)

Useful while actively changing one service's code. Each service needs
its own virtual environment set up once:

```bash
cd services/user-service
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt      # Windows: .\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

(repeat for `itinerary-service`, `recommendation-service`, `chat-service`, `gateway`)

Then, 5 separate terminals, same `GLOBETROTTER_JWT_SECRET` in all of them:

**Terminal 1 — User Service**
```bash
cd services/user-service
export GLOBETROTTER_JWT_SECRET="dev-secret"
export ADMIN_EMAILS="admin@example.cm"
./.venv/bin/python -m uvicorn app.main:app --port 8001
```

**Terminal 2 — Itinerary Service**
```bash
cd services/itinerary-service
export GLOBETROTTER_JWT_SECRET="dev-secret"
./.venv/bin/python -m uvicorn app.main:app --port 8002
```

**Terminal 3 — Recommendation Service**
```bash
cd services/recommendation-service
export GLOBETROTTER_JWT_SECRET="dev-secret"
export USER_SERVICE_URL="http://localhost:8001"
export ITINERARY_SERVICE_URL="http://localhost:8002"
./.venv/bin/python -m uvicorn app.main:app --port 8003
```

**Terminal 4 — Chat Service**
```bash
cd services/chat-service
export GLOBETROTTER_JWT_SECRET="dev-secret"
export USER_SERVICE_URL="http://localhost:8001"
./.venv/bin/python -m uvicorn app.main:app --port 8004
```

**Terminal 5 — Gateway** (API root: http://localhost:8000)
```bash
cd services/gateway
export GLOBETROTTER_JWT_SECRET="dev-secret"
export USER_SERVICE_URL="http://localhost:8001"
export ITINERARY_SERVICE_URL="http://localhost:8002"
export RECOMMENDATION_SERVICE_URL="http://localhost:8003"
export CHAT_SERVICE_URL="http://localhost:8004"
./.venv/bin/python -m uvicorn app.main:app --port 8000
```

This way calls won't work (Jitsi isn't running without Docker Compose)
but everything else — including chat — does.

## Running the tests

Each service has its own suite, run from inside that service's folder:

```bash
cd services/user-service
./.venv/bin/python -m pytest -q
```

(same for the other 4 folders). Some tests ("inter-service integration")
launch real sibling services as subprocesses to prove the HTTP calls
between services genuinely work, not just that each service works in
isolation.

## Roles: admin vs. regular user

Whoever's email is listed in `ADMIN_EMAILS` becomes an admin the moment
they register or next log in (see `services/user-service/app/routers/
auth.py`). Admins can edit/delete destinations directly; regular users
submit a request an admin approves or rejects instead. Add or remove an
email from `ADMIN_EMAILS` and it takes effect on that person's next
login.

## Google Sign-In (optional)

Email/password always works. To also enable "Continue with Google":

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs
   & Services → Credentials → **Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized JavaScript origins: wherever the frontend is served from.
4. Copy the **Client ID** into this repo's `.env` as `GOOGLE_CLIENT_ID`
   (the User Service verifies Google's token against it) — and also set
   the same value as `VITE_GOOGLE_CLIENT_ID` when building the frontend
   repo, since it needs it too.

No billing tier, no credit card. A Client ID is a public identifier, not
a secret.

## Calls: what to know before you demo them

Jitsi runs with HTTPS **on** (not optional): browsers block camera/mic
access on anything that isn't HTTPS or the literal hostname `localhost`.
Three deployment shapes:

- **Everyone on the same machine**: the defaults in `.env.example` just
  work — Jitsi generates its own self-signed certificate automatically.
  The first time anyone opens the call tab, click through the browser's
  "not private" warning once.
- **Two devices on the same LAN**: set `JITSI_PUBLIC_URL` and
  `DOCKER_HOST_ADDRESS` in `.env` to your machine's real LAN IP (e.g.
  `https://192.168.1.23:8443`), not `localhost`.
- **Deployed on a VPS**: point a domain at the VPS, open ports 80+443,
  and set `ENABLE_LETSENCRYPT=1` + `LETSENCRYPT_DOMAIN` +
  `LETSENCRYPT_EMAIL` + `JITSI_PUBLIC_URL=https://your-domain` +
  `JITSI_HTTP_PORT=80` + `JITSI_HTTPS_PORT=443` — see the full
  walkthrough in `.env.example`.

Chat Service only ever broadcasts a Jitsi room name over the chat
WebSocket when someone taps "Start a call" — it never touches audio or
video itself.

## Honest limitations of this phase

- **Shared JWT secret** across every service (`GLOBETROTTER_JWT_SECRET`).
  A real deployment would use per-service keys and short-lived tokens.
- **Still JSON files, not a real database** — each service has its own
  `data/` folder.
- **Chat Service is a single process** — scaling it to more than one
  instance would need a shared pub/sub (e.g. Redis).
- **No Kubernetes, load balancing, auto-scaling, caching layer, circuit
  breakers, or distributed tracing.**
- **The AI assistant is a free keyword search, not a generative model.**

## What was removed from the original combined project

- Each service's `.venv/` (regenerate with the commands above —
  committing a virtual environment, especially a Windows one, doesn't
  travel between machines anyway)
- `__pycache__/` and `.pytest_cache/` directories
- The root `.env` (real secrets) — only `.env.example` is included
- The Phase 1 monolith (`backend/`) and the `frontend/` folder — both
  live elsewhere now (the frontend in its own repo; the monolith wasn't
  carried over per your choice)
- `run.sh` / `run.bat` — those were Phase 1's single-process launchers
  and don't apply to this microservices layout
