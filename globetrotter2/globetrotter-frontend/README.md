# GlobeTrotter Frontend

React + Vite frontend for GlobeTrotter, a travel guide and itinerary
planner. This is the **frontend-only** half of the project, split out so
it can live in its own repo. It talks to the GlobeTrotter backend
(Gateway + microservices) over HTTP/WebSocket — see that repo for how to
run the API.

## Setup

```bash
npm install
npm run dev
```

By default the dev server (port 5173) talks to a Gateway running at
`http://localhost:8000` — see `src/api/client.js` for the exact logic
(it also auto-detects GitHub Codespaces and rewrites the port). If your
backend runs somewhere else, edit `API_BASE_URL` there.

## Build for production

```bash
npm run build
```

Outputs to `dist/`. Serve that folder from any static host (Netlify,
Vercel, S3 + CloudFront, nginx, etc.) — when the app is served from the
same origin as the API it uses relative URLs automatically; otherwise
point `API_BASE_URL` in `src/api/client.js` at the Gateway's real URL
before building.

## Environment variables (optional, at build time)

Vite bakes these in when you run `npm run build`; both are safe to be
public — a Google OAuth Client ID and a Jitsi server address are
identifiers, not secrets:

- `VITE_GOOGLE_CLIENT_ID` — enables the "Continue with Google" button on
  the login screen (used in `src/pages/Login.jsx`). Leave unset and the
  button just doesn't render; email/password still works. Must match the
  `GOOGLE_CLIENT_ID` configured on the backend.
- `VITE_JITSI_URL` — the self-hosted Jitsi server the "Join call" button
  opens (used in `src/pages/Chat.jsx` and `Login.jsx`). Must match
  `JITSI_PUBLIC_URL` on the backend. Defaults to `http://localhost:8443`.

Example:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com npm run build
```

or create a `.env` file (gitignored) with:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_JITSI_URL=https://your-domain:8443
```

## Structure

```
src/
├── api/client.js     central place every screen calls the backend from
├── pages/             screens (Login, Chat, itinerary planner, etc.)
├── components/
└── assets/
```

## What was removed from the original combined project

- `node_modules/` — regenerate with `npm install`
- `dist/` — regenerate with `npm run build`

Both were already gitignored in the original project and aren't meant to
be committed.
