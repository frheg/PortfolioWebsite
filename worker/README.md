# space-relay

Cloudflare Worker, free tier. Relay + edge cache + multiplayer room. No heavy compute (10 ms CPU cap).

| Route | What | Cache |
|---|---|---|
| `GET /sats/:group` | CelesTrak GP JSON (stations, visual, gps-ops, galileo, starlink) | 2 h |
| `GET /mp` (WebSocket) | multiplayer room, Durable Object (SQLite, hibernating), max 64 | — |

Origin allowlist: `ALLOWED_ORIGINS` in `wrangler.toml` (exact origins, or `.suffix` host match).

## Deploy (once)

```sh
cd worker
npx wrangler login
npx wrangler deploy        # → https://space-relay.<you>.workers.dev
```

Site side: set the URL at build time.

```sh
# .env.local (dev) / .env.production (build) — *.local is gitignored
VITE_RELAY_URL=https://space-relay.<you>.workers.dev
```

Empty → multiplayer off, satellites straight from CelesTrak.

Site build (GitHub Actions) gets `VITE_RELAY_URL` from `.github/workflows/deploy.yml` (repo variable overrides).

## Local test

```sh
cd worker && npx wrangler dev --port 8787
VITE_RELAY_URL=http://127.0.0.1:8787 npm run dev
```

## Free-tier budget (check current Cloudflare docs)

- Workers: 100k req/day. Sats ≈ 2 per visit (localStorage-cached 6 h).
- Durable Objects: inbound WS messages bill 20:1 as requests → ~2M msgs/day. 4 Hz moving → ~140 player-hours/day,
  idle (0.2 Hz) ~20× cheaper. Room awake while anyone online (128 MB × 24 h ≈ 11k GB-s, under the 13k free).
- Over quota → errors until UTC reset; site degrades (no sats / offline badge), nothing breaks.
