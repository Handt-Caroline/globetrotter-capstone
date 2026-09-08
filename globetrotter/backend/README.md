# GlobeTrotter Backend — Phase 1 (Monolith)

A single FastAPI server, storing everything in one JSON file
(`data/db.json`), exactly matching what your React frontend's
`src/api/client.js` already expects. No database setup needed.

## 1. Install dependencies

Open a terminal **inside this `globetrotter-backend` folder** and run:

```bash
# (optional but recommended) create an isolated environment first
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

# install the 3 packages this project needs
pip install -r requirements.txt
```

## 2. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

- `--reload` restarts the server automatically whenever you save a file —
  handy while developing.
- Visit **http://localhost:8000** in a browser — you should see:
  `{"status":"ok","service":"GlobeTrotter API","phase":"Phase 1 - Monolith"}`
- Visit **http://localhost:8000/docs** — FastAPI auto-generates a full
  interactive API explorer here. Great for testing endpoints without
  needing the frontend at all.

The very first time it runs, it creates `data/db.json` seeded with 18
sample Yaoundé destinations. Delete that file any time to reset to a
clean slate.

## 3. Point your frontend at it

Your frontend already does this automatically — `src/api/client.js`
talks to `http://localhost:8000` by default. So with this backend
running on port 8000 and your frontend running on its usual port
(5173), just start the frontend as normal:

```bash
# in the globetrotter-frontend folder, in a SEPARATE terminal
npm install
npm run dev
```

Then open the frontend URL it prints, register a new account, and you
should be talking to a real backend end-to-end: registering, browsing
Yaoundé destinations, picking interests during onboarding, getting
personalized recommendations, building an itinerary, and saving
favorites.

## Project layout

```
globetrotter-backend/
├── requirements.txt
├── data/
│   └── db.json              <- created automatically on first run
└── app/
    ├── main.py               <- the entry point; run this with uvicorn
    ├── storage.py             <- reads/writes data/db.json ("our database")
    ├── security.py            <- password hashing + JWT tokens
    ├── deps.py                <- "who is making this request?" helper
    ├── constants.py           <- interest-label -> category-id lookup
    ├── seed.py                <- the 18 starter Yaoundé destinations
    └── routers/
        ├── auth.py            <- /auth/register, /auth/login, /auth/me
        ├── destinations.py    <- /destinations, /destinations/{id}, /destinations/categories
        ├── recommendations.py <- /recommendations, /recommendations/preferences
        ├── itineraries.py     <- /itineraries (list/create/delete)
        └── favorites.py       <- /favorites (list/add/remove)
```

## Endpoints (Phase 1 checklist)

| Method | Path                              | Auth? | Used by (frontend page)         |
|--------|-----------------------------------|-------|----------------------------------|
| POST   | /auth/register                    | no    | Login.jsx                        |
| POST   | /auth/login                       | no    | Login.jsx                        |
| GET    | /auth/me                          | yes   | Profile.jsx, AiChat.jsx          |
| GET    | /destinations                     | no    | Destinations.jsx, Itinerary.jsx  |
| GET    | /destinations/categories          | no    | (available for you to use)       |
| GET    | /destinations/{id}                | no    | SiteDetail.jsx                   |
| POST   | /recommendations/preferences      | yes   | Onboarding.jsx, Profile.jsx      |
| GET    | /recommendations/preferences      | yes   | (available for you to use)       |
| GET    | /recommendations                  | yes   | ForYou.jsx                       |
| GET    | /itineraries                      | yes   | Itinerary.jsx                    |
| POST   | /itineraries                      | yes   | Itinerary.jsx, SiteDetail.jsx    |
| DELETE | /itineraries/{id}                 | yes   | (available for you to use)       |
| GET    | /favorites                        | yes   | Favorites.jsx                    |
| POST   | /favorites/{destination_id}       | yes   | (available for you to use)       |
| DELETE | /favorites/{destination_id}       | yes   | Favorites.jsx                    |

That's 15 working endpoints — well past the "at least 5" the lecture
asked for — because your frontend was already built expecting all of
them.

## Known Phase 1 limitations (on purpose!)

These map straight onto the "Challenges of the Monolith" slide from
Class 2 — they're not bugs, they're the point of Phase 1:

- **JSON file storage**: no real transactions, no indexing, and two
  simultaneous writes could in theory race (we added a lock to reduce
  this, but it's not a substitute for a real database).
- **One process does everything**: auth, destinations, recommendations,
  and itineraries all live in the same app. In Phase 2 you'll split
  these into independent services.
- **No horizontal scaling**: you can only run one copy of this server
  against one `db.json` file.

You'll fix these in Phase 2 (microservices) and Phase 3 (cloud
deployment), per the slides.
