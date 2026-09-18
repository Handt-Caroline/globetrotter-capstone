# Live deployment notes

## Where

- VPS: Contabo, `38.242.246.126`
- Repo cloned to: `/var/www/globetrotter-frontend`
- Served by nginx on port **8106** (no domain yet - see below), config at
  `deploy/nginx/globetrotter-frontend`
- nginx serves the built `dist/` directly and reverse-proxies the known API
  path prefixes to the backend Gateway at `127.0.0.1:8105` (same origin -
  see the backend repo's `deploy/DEPLOYMENT.md` for why the Gateway itself
  isn't publicly exposed)

## First-time setup on a fresh clone

Requires the backend already deployed and its Gateway running on
`127.0.0.1:8105` (see the backend repo).

```bash
./deploy/install.sh
```

## Pulling new code later

```bash
./update.sh
```

## Live URL

`http://38.242.246.126:8106` - plain HTTP, no domain yet.

## Known limitations of the current live setup

- **No domain, no HTTPS.** Fine for testing, not for real users. Once you
  have a domain pointed at this VPS, switch `deploy/nginx/globetrotter-frontend`
  to `server_name yourdomain.com;`, run certbot for a cert, and update this
  file and the backend's accordingly.
- **"Continue with Google" won't render** - `VITE_GOOGLE_CLIENT_ID` wasn't
  set at build time. Add it and rebuild if you want it.
- **Calls don't work** - needs both Jitsi deployed (see backend repo) and
  HTTPS (browsers block camera/mic access on plain HTTP).
- If a fresh deploy ever times out from outside the VPS after
  `deploy/install.sh` runs, check Contabo's own cloud-level firewall in
  their control panel - `ufw` being open isn't always sufficient.
