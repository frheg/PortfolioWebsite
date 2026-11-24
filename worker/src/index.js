// space-relay: tiny Cloudflare Worker (free tier). Relay + edge cache only, no heavy compute (10 ms CPU cap).
//   GET /flights?lat=&lon=  → ADS-B aircraft round a 1° grid point (ADSB.lol → adsb.fi → OpenSky), cache 8 s, stale ≤ 5 min
//   GET /sats/:group        → CelesTrak GP JSON (whitelisted groups), cache 2 h → users never hit CelesTrak
//   GET /mp (WebSocket)     → multiplayer room (Durable Object, hibernating)
// Bodies streamed through untouched (no JSON parse → ~0 CPU).
import { DurableObject } from 'cloudflare:workers'

const SAT_GROUPS = new Set(['stations', 'visual', 'gps-ops', 'galileo', 'starlink'])
const FLIGHT_RADIUS_NM = 120
const FLIGHT_TTL_S = 8
const SAT_TTL_S = 7200
const STALE_S = 300 // all upstreams down → last good copy this long

function allowedOrigin(origin, env) {
  if (!origin) return null
  const list = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  try {
    const host = new URL(origin).hostname
    const ok = list.some((o) => (o.startsWith('.') ? host.endsWith(o) : origin === o || host === o))
    return ok ? origin : null
  } catch {
    return null
  }
}

const withCors = (res, origin) => {
  const out = new Response(res.body, res)
  if (origin) out.headers.set('Access-Control-Allow-Origin', origin)
  out.headers.set('Vary', 'Origin')
  return out
}

// Edge cache (per colo). Key = normalized upstream URL. Second "stale" copy (longer TTL) → served when upstream fails.
async function cached(ctx, key, ttl, fetchUpstream, staleTtl = ttl) {
  const cache = caches.default
  const req = new Request(key)
  const staleReq = new Request(`${key}?stale`)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetchUpstream().catch(() => new Response(null, { status: 504 }))
  if (!res.ok) {
    const stale = await cache.match(staleReq)
    if (stale) return stale
    return new Response(JSON.stringify({ error: res.status }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
  const body = await res.arrayBuffer()
  const make = (age) => new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${age}` } })
  ctx.waitUntil(Promise.all([cache.put(req, make(ttl)), cache.put(staleReq, make(staleTtl))]))
  return make(ttl)
}

const UA = () => ({ headers: { 'User-Agent': 'space-relay (fredrichegland.no portfolio)' }, signal: AbortSignal.timeout(15_000) })

async function flights(url, ctx) {
  const lat = Math.round(Number(url.searchParams.get('lat')))
  const lon = Math.round(Number(url.searchParams.get('lon')))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return new Response('bad', { status: 400 })
  return cached(
    ctx,
    `https://relay.cache/flights/${lat}/${lon}`,
    FLIGHT_TTL_S,
    async () => {
      // Shared Cloudflare egress IPs get rate-limited → try each source in turn.
      const sources = [
        () => fetch(`https://api.adsb.lol/v2/point/${lat}/${lon}/${FLIGHT_RADIUS_NM}`, UA()),
        () => fetch(`https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${FLIGHT_RADIUS_NM}`, UA()),
        () => openSky(lat, lon),
      ]
      let last = new Response(null, { status: 504 })
      for (const src of sources) {
        last = await src().catch(() => new Response(null, { status: 504 }))
        if (last.ok) return last
      }
      return last
    },
    STALE_S
  )
}

// OpenSky (anonymous) → readsb-shaped { ac: [...] }. Small box (±2°) → small JSON, cheap parse.
async function openSky(lat, lon) {
  const q = `lamin=${lat - 2}&lamax=${lat + 2}&lomin=${lon - 4}&lomax=${lon + 4}`
  const res = await fetch(`https://opensky-network.org/api/states/all?${q}`, UA())
  if (!res.ok) return res
  const j = await res.json()
  const now = j.time ?? Date.now() / 1000
  const M_FT = 3.28084
  const ac = (j.states ?? [])
    .filter((s) => s[5] !== null && s[6] !== null)
    .map((s) => ({
      hex: s[0],
      flight: s[1],
      lon: s[5],
      lat: s[6],
      alt_baro: s[8] ? 'ground' : s[7] !== null ? Math.round(s[7] * M_FT) : undefined,
      alt_geom: s[13] !== null ? Math.round(s[13] * M_FT) : undefined,
      gs: s[9] !== null ? s[9] * 1.943844 : 0,
      track: s[10] ?? 0,
      geom_rate: s[11] !== null ? s[11] * M_FT * 60 : 0,
      seen_pos: s[3] ? Math.max(0, now - s[3]) : 0,
    }))
  return new Response(JSON.stringify({ ac }), { headers: { 'Content-Type': 'application/json' } })
}

async function sats(group, ctx) {
  if (!SAT_GROUPS.has(group)) return new Response('bad', { status: 400 })
  return cached(
    ctx,
    `https://relay.cache/sats/${group}`,
    SAT_TTL_S,
    () => fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`, UA()),
    86_400 // CelesTrak down → day-old elements still fine
  )
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const origin = allowedOrigin(request.headers.get('Origin'), env)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } : {} })
    }
    if (url.pathname === '/mp') {
      // Browser WS always sends Origin → only our sites get in.
      if (!origin) return new Response('forbidden', { status: 403 })
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 })
      const room = env.ROOM.get(env.ROOM.idFromName('global'))
      return room.fetch(request)
    }
    if (request.method !== 'GET') return new Response('method', { status: 405 })
    if (url.pathname === '/flights') return withCors(await flights(url, ctx), origin)
    const m = /^\/sats\/([a-z-]+)$/.exec(url.pathname)
    if (m) return withCors(await sats(m[1], ctx), origin)
    return new Response('space-relay', { status: 404 })
  },
}

// ─── Multiplayer room ────────────────────────────────────────────────────────
// Hibernation API: sockets survive DO eviction; per-player state in socket attachment (≤ 2 KB).
// Client → { f: frameKey, p: [x,y,z], q: [x,y,z,w], v: [x,y,z] } (frame-local km, km/s) ≤ 5 Hz.
// Room → { t: 'w', n, players: [[id, name, f, p, q, v, ageMs]] } batched ≤ 4 Hz.  On join → { t: 'hi', id, name }.
const MAX_PLAYERS = 64
const FLUSH_MS = 250
const STALE_MS = 30_000
const MIN_GAP_MS = 180 // per-socket rate limit
const FRAMES = new Set(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'])
const ADJ = ['Rask', 'Stille', 'Lys', 'Mørk', 'Kald', 'Varm', 'Vill', 'Blå', 'Rød', 'Gyllen']
const NOUN = ['Komet', 'Måne', 'Sonde', 'Ørn', 'Rev', 'Ugle', 'Pulsar', 'Kvasar', 'Nova', 'Meteor']

const vec = (a, n, max) => Array.isArray(a) && a.length === n && a.every((x) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < max)

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.flushTimer = null
  }

  async fetch() {
    const sockets = this.ctx.getWebSockets()
    if (sockets.length >= MAX_PLAYERS) return new Response('full', { status: 503 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    const id = crypto.randomUUID().slice(0, 8)
    const name = `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`
    server.serializeAttachment({ id, name, s: null, at: 0 })
    server.send(JSON.stringify({ t: 'hi', id, name }))
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > 400) return
    const meta = ws.deserializeAttachment()
    const now = Date.now()
    if (now - meta.at < MIN_GAP_MS) return
    let m
    try {
      m = JSON.parse(message)
    } catch {
      return
    }
    if (!FRAMES.has(m.f) || !vec(m.p, 3, 1e22) || !vec(m.q, 4, 1.01) || !vec(m.v, 3, 1e15)) return
    meta.s = { f: m.f, p: m.p, q: m.q, v: m.v }
    meta.at = now
    ws.serializeAttachment(meta)
    this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_MS)
  }

  flush() {
    this.flushTimer = null
    const now = Date.now()
    const sockets = this.ctx.getWebSockets()
    const players = []
    for (const ws of sockets) {
      const a = ws.deserializeAttachment()
      if (a?.s && now - a.at < STALE_MS) players.push([a.id, a.name, a.s.f, a.s.p, a.s.q, a.s.v, now - a.at])
    }
    const msg = JSON.stringify({ t: 'w', n: sockets.length, players })
    for (const ws of sockets) {
      try {
        ws.send(msg)
      } catch {
        // closing socket
      }
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye')
    } catch {
      // already closed
    }
    this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_MS)
  }

  async webSocketError(ws) {
    try {
      ws.close(1011, 'error')
    } catch {
      // already closed
    }
  }
}
