# GlobeTrotter Travel Assistant

Frontend and backend in one project. The FastAPI server can serve the
React app itself, so the whole thing runs from **one command on one port**.

```
globetrotter/
├── backend/            FastAPI API (Python) - also serves the built frontend
│   ├── app/            routers, storage, security, seed data
│   ├── data/           db.json is created here on first run
│   └── requirements.txt
├── frontend/           React + Vite app
│   ├── src/            pages, components, api/client.js
│   └── dist/           the built app (already built and included)
├── scripts/
│   └── load_test.py    proves the monolith's limits with real numbers
├── run.sh              one-command start (macOS / Linux / Codespaces)
└── run.bat             one-command start (Windows)
```

---

## Quick start (one server, one port)

macOS / Linux / GitHub Codespaces:

```bash
./run.sh
```

Windows:

```bat
run.bat
```

Then open **http://localhost:8000**. That's the whole app - the API and
the React screens come from the same server.

The script creates a Python virtual environment, installs the backend
requirements, rebuilds the frontend (a couple of seconds, so a change always
shows up on the next run), and starts the server. If Node isn't installed it
reuses the `frontend/dist` build that ships in the repo.

### Optional: real street routing

The map and each itinerary's page draw routes that follow actual streets,
calculated by [OpenRouteService](https://openrouteservice.org) — a free
routing engine built on the same OpenStreetMap data the map tiles come from.
That needs a free API key. Two ways to give it one:

```bash
# 1. For the current terminal only
export ORS_API_KEY=your_key_here      # Windows: set ORS_API_KEY=your_key_here

# 2. So it sticks between runs: copy the template and fill it in.
#    run.sh / run.bat load backend/.env automatically; it's gitignored.
cp backend/.env.example backend/.env
```

Get a key at <https://openrouteservice.org/dev/#/signup>.

**You don't have to.** Without a key the app still works: it falls back to
the straight-line distance estimate it has always used, draws the route as a
dashed line instead of a solid one, and says on screen that it's an estimate.
Nothing breaks, and nothing pretends to be measured when it isn't.

The key is only ever read by the backend (`ORS_API_KEY`, see
`backend/app/routers/routing.py`). The browser calls our own
`POST /routing/directions`, never OpenRouteService directly — a key placed in
frontend code is a public key, and anyone could spend your quota with it.
`GET /routing/status` reports whether a key is configured.

### Doing it by hand

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs
Health check: http://localhost:8000/health

---

## Running the tests

```bash
cd backend
pip install -r requirements.txt      # includes pytest
python -m pytest
```

51 tests cover registration and login (including the security rule that a
wrong password and an unknown email must give the *same* error), the shape
of every destination, favourites and itineraries staying private to their
owner (including that one user can't open another's itinerary by id),
recommendations matching the chosen interests, the metrics endpoint, the
global chat (who may read, who may post, and that `since` really does return
only new messages), and the routing proxy — in particular that with no
OpenRouteService key it still returns a usable, correctly-labelled estimate
rather than an error. Each test gets its own temporary database, so they
never touch `data/db.json` and never interfere with each other.

## Seeing the monolith's limits

```bash
# terminal 1
cd backend && uvicorn app.main:app --port 8000

# terminal 2
python scripts/load_test.py
```

The script pretends to be 1, then 5, 10, 25 and 50 users at once and reports
average / p95 / max response times for reads and writes. Open
**http://localhost:8000/system-health** in the app while it runs to watch the
same numbers live.

Writes get slower than reads as users increase, because every write locks and
rewrites the whole `db.json`. That is the Phase 1 lesson, measured rather than
asserted - and the argument for microservices, caching and queues later.

## What's in the app

- **28 real Yaounde destinations** with researched histories (dates, names and
  events from public sources), practical advice, and prices in FCFA.
- **French and English** - the EN/FR switch changes both the interface and the
  destination text, which the backend serves via `?lang=fr`.
- **Audio guide** - the browser reads any section aloud in the selected
  language. No audio files, no server, works offline.
- **A real map** - Leaflet + OpenStreetMap: pan, zoom, GPS location, exact
  coordinates, and live nearby hospitals / pharmacies / fuel / hotels /
  banks / police.
- **Real directions** - OpenRouteService draws the route along the actual
  streets, on the map, with distance, travel time and turn-by-turn
  instructions, for walking or by taxi. No key configured? It falls back to a
  straight-line estimate and says so.
- **Itineraries, one page each** - the Trips screen is an overview list; open
  one and you get that trip on its own page with its route drawn on the map,
  the stops in order, and estimated shared-taxi, moto and private-taxi fares
  in FCFA.
- **Global chat** - one room shared by everyone using the app, reachable from
  the menu on every screen, for the things no dataset knows: which market is
  open today, whether a road is passable, what a taxi actually costs right now.
- **A notification inbox that works** - the bell carries an unread count,
  opens the inbox, and every notification opens in full and links through to
  the trip, place or payment it is about.
- **Observability** - `/metrics` plus a System health dashboard at
  `/system-health`.
- **Installable and offline-capable** - a PWA whose service worker caches the
  app shell and the most recent API responses.

## Working on the frontend

While editing React code you still want Vite's dev server for instant
hot reload. Run two terminals:

**Terminal 1 - backend**

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - frontend**

```bash
cd frontend
npm install     # first time only
npm run dev
```

Open http://localhost:5173. `src/api/client.js` detects that it's running
on the Vite dev server and points at `http://localhost:8000` automatically;
when the app is served by FastAPI instead, it uses relative URLs. You never
have to edit that file.

When you're done editing, rebuild so the single-server mode picks up your
changes:

```bash
cd frontend
npm run build
```

---

## How the two halves connect

- `frontend/src/api/client.js` is the only place that talks to the API.
  Every screen imports `api` from it.
- `backend/app/main.py` registers the API routers first (`/auth`,
  `/destinations`, `/recommendations`, `/itineraries`, `/favorites`,
  `/routing`, `/chat`), then mounts `frontend/dist` last with a catch-all
  that returns `index.html` so React Router can handle browser routes like
  `/login` and `/site/:id`.
- The React app has three pieces of app-wide state, each a context in its own
  file: `src/i18n.jsx` (language), `src/theme.jsx` (light/dark) and
  `src/notifications.jsx` (the inbox and its unread count).
  `src/components/Layout.jsx` is the shell every screen renders inside - the
  header, the menu drawer and the row of the three main destinations.
- Data lives in `backend/data/db.json`, created automatically on first
  run and seeded with sample destinations. Delete that file to reset.

## Notes

- The backend still enables permissive CORS, which is what makes the
  two-terminal dev setup work. In single-server mode it isn't needed,
  but it's harmless to leave on for a class project.
- `frontend/dist/` ships inside this folder so the project runs even
  without Node installed. It is listed in `.gitignore`, since build
  output normally shouldn't be committed - if you push this to GitHub
  and want the built app to come along, delete that line from
  `.gitignore`.
