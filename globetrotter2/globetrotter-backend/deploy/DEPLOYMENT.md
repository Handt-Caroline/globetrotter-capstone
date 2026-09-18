# Live deployment notes

This documents the actual setup running on the Contabo VPS, so the repo is
self-contained if you (or anyone else) need to rebuild it from scratch.

## Where

- VPS: Contabo, `38.242.246.126`
- Repo cloned to: `/root/globetrotter-backend`
- Each service in its own venv at `services/<name>/.venv`
- Each service runs as its own systemd unit (see `deploy/systemd/`)

## Ports (chosen to avoid clashing with everything else already running on
## this box - see `sudo ss -tulpn` before picking new ones if you add a service)

| Service                | Port  | Bind address |
|-------------------------|-------|--------------|
| user-service             | 8101  | 127.0.0.1 (internal only) |
| itinerary-service         | 8102  | 127.0.0.1 (internal only) |
| recommendation-service    | 8103  | 127.0.0.1 (internal only) |
| chat-service               | 8104  | 127.0.0.1 (internal only) |
| gateway                     | 8105  | 127.0.0.1 (internal only - see below) |

The Gateway is deliberately **not** bound to `0.0.0.0` - it's fronted by
nginx (part of the frontend repo's `deploy/nginx/` config, running on
port 8106) which reverse-proxies the known API path prefixes to it. Nothing
except nginx on this same machine can reach the Gateway directly.

## First-time setup on a fresh clone

```bash
cp .env.example .env    # then fill it in - see the file's own comments
./deploy/install.sh
```

## Pulling new code later

```bash
./update.sh
```

## Firewall

`ufw` needed an explicit rule added for whatever port fronts this (the
frontend's nginx, currently 8106) - it defaults to denying anything not
explicitly listed:

```bash
sudo ufw allow 8106/tcp
sudo ufw reload
```

Contabo also has its own cloud-level firewall in the customer control panel,
separate from `ufw` - check there too if a newly-opened port still isn't
reachable from outside after the `ufw` rule is in place.

## Known limitations of the current live setup

- **No domain, no HTTPS** - everything is plain HTTP on the raw IP. Fine for
  testing, not for real users (credentials travel unencrypted). Get a domain
  and switch to Let's Encrypt (certbot) before relying on this for anything
  but a demo.
- **Jitsi (video calls) is not deployed** - it needs Docker Compose (4
  containers), which this systemd-based deployment intentionally skips in
  favor of running the 5 core Python services directly. Calls also need
  HTTPS regardless (browsers block camera/mic on plain HTTP), so this is
  blocked on the domain/TLS step anyway.
- **`ADMIN_EMAILS` in `.env`** must be set to a real email for anyone to
  actually get admin rights - it's not the `admin@example.cm` placeholder
  in a real deployment.
