# GlobeTrotter – Yaoundé Travel Assistant

GlobeTrotter is a **monolithic Node.js / Express application** built for a semester-long
capstone project. It starts as a single deployable service (Phase 1), and will later be
refactored into microservices (Phase 2), deployed to the cloud (Phase 3), and hardened
with resilience patterns (Phase 4).

> **Note:** The capstone brief was originally written around a Flask/Python starter
> project. This implementation swaps that for Node.js + Express instead (approved by
> the course lecturer — see `DEVLOG.md`). The architecture and phase goals are unchanged,
> only the tech stack differs.

This build is themed around real tourist sites in Yaoundé, Cameroon, and goes beyond the
base brief with a bookings + manual mobile-money payment flow (MTN MoMo / Orange Money).

---

## Project Structure

```
.
├── src/
│   ├── server.js                    # App entry point — wires up all routes
│   ├── db.js                        # JSON file data layer (queued writes, no DB yet)
│   ├── middleware/
│   │   └── auth.js                  # JWT verification middleware
│   └── routes/
│       ├── auth.routes.js           # Register, login, update preferences
│       ├── sites.routes.js          # Browse/search sites, post comments
│       ├── recommendations.routes.js# Personalised site recommendations
│       ├── itineraries.routes.js    # Create / view / edit itineraries
│       ├── bookings.routes.js       # Create bookings, view own bookings
│       ├── payments.routes.js       # Submit MoMo/Orange Money payment reference
│       └── admin.routes.js          # Admin verifies a payment, confirms booking
├── data/
│   └── db.json                      # Single JSON file acting as the "database"
├── Dockerfile
├── docker-compose.yml
├── package.json
└── DEVLOG.md                        # Running log of development decisions
```

---

## REST API

| Method | Endpoint                          | Auth required | Description                                    |
|--------|------------------------------------|:---:|-------------------------------------------------|
| POST   | `/auth/register`                  | No  | Register a new user                              |
| POST   | `/auth/login`                     | No  | Authenticate and receive a JWT token             |
| PUT    | `/auth/preferences`               | Yes | Update the categories you're interested in       |
| GET    | `/sites`                          | No  | Search sites (`?category=`, `?search=`)          |
| GET    | `/sites/:id`                      | No  | View one site's details and comments             |
| POST   | `/sites/:id/comments`             | Yes | Leave a comment on a site                        |
| GET    | `/recommendations`                | Yes | Get personalised site recommendations            |
| POST   | `/itineraries`                    | Yes | Create a new itinerary                           |
| GET    | `/itineraries`                    | Yes | List your itineraries                            |
| GET    | `/itineraries/:id`                | Yes | View one itinerary                               |
| PUT    | `/itineraries/:id/sites`          | Yes | Add a site to an itinerary                       |
| POST   | `/bookings`                       | Yes | Book a site (returns MoMo/Orange payment details)|
| GET    | `/bookings`                       | Yes | List your bookings                               |
| GET    | `/bookings/:id`                   | Yes | View one of your bookings                        |
| POST   | `/bookings/:id/submit-payment`    | Yes | Submit a mobile-money payment reference          |
| POST   | `/admin/bookings/:id/verify`      | Admin key | Confirm a payment was received             |

Protected routes expect the header: `Authorization: Bearer <your-token>`
The admin route expects the header: `x-admin-key: <ADMIN_KEY>`

### Example requests

```bash
# Register (preferences are optional category tags)
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "s3cr3t", "preferences": ["culture", "nature"]}'

# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "s3cr3t"}'
# Save the returned token: TOKEN=<value from .token field>

# Search sites
curl "http://localhost:4000/sites?category=nature"

# Personalised recommendations
curl http://localhost:4000/recommendations \
  -H "Authorization: Bearer $TOKEN"

# Update preferences
curl -X PUT http://localhost:4000/auth/preferences \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"preferences": ["wildlife"]}'

# Create an itinerary
curl -X POST http://localhost:4000/itineraries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Yaoundé Weekend", "startDate": "2026-08-01", "endDate": "2026-08-03"}'

# Book a site
curl -X POST http://localhost:4000/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"siteId": "s4"}'
```

Available site categories in the seed data: `culture`, `landmark`, `market`, `nature`,
`religious`, `shopping`, `wildlife`.

---

## Running Locally

### Prerequisites
- Node.js 18+
- npm

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables and fill in real values
cp .env.example .env   # if you don't have one yet, see Configuration below

# 3. Start the server (auto-restarts on changes)
npm run dev

# or start it plainly
npm start
```

The API will be available at `http://localhost:4000` (or whatever `PORT` you set).

---

## Running with Docker

```bash
# Build and start
docker-compose up --build

# Stop
docker-compose down
```

The `data/` directory is mounted into the container, so `db.json` persists between runs.

---

## Data Storage

All data is persisted in a single JSON file: `data/db.json`, containing `users`, `sites`,
`itineraries`, `bookings`, and `payments`. Writes are funnelled through a queue in
`src/db.js` so concurrent requests can't corrupt the file. This is intentionally simple —
Phase 1's job is to demonstrate the limitations of this approach (no real transactions,
no indexing, everything read/written as one blob) before Phase 2 replaces it.

> `data/db.json` is excluded from version control via `.gitignore` — only `data/.gitkeep`
> is committed, so the repo stays clean and each environment seeds its own data.

---

## Configuration

Environment variables (set in a local `.env` file, never committed):

| Variable             | Description                                            |
|-----------------------|--------------------------------------------------------|
| `PORT`                | Port the app listens on (defaults to `4000`)            |
| `JWT_SECRET`          | Signing key for login tokens — must be a long random value in production |
| `ADMIN_KEY`           | Secret key required to call `/admin/bookings/:id/verify` |
| `ADMIN_MOMO_NUMBER`   | MTN MoMo number shown to users after booking            |
| `ADMIN_ORANGE_NUMBER` | Orange Money number shown to users after booking        |

> **Important:** Never commit real values for `JWT_SECRET` or `ADMIN_KEY`. Generate a
> strong secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## Project Phases

| Phase | Goal |
|-------|------|
| Phase 1: Monolith | ✅ This build — single Express server, JSON file storage, JWT auth |
| Phase 2: Microservices | Split into independent services with inter-service communication |
| Phase 3: Cloud Deployment | Docker, load balancing, auto-scaling, cloud deployment |
| Phase 4: Resilience | Caching, circuit breakers, fault tolerance |
