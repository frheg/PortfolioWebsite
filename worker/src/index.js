// space-relay: tiny Cloudflare Worker (free tier). Relay + edge cache only, no heavy compute (10 ms CPU cap).
//   GET /flights?lat=&lon=  → aircraft within ~250 km of a 1° grid point, from the latest snapshot, cache 20 s
//   POST /flights/snapshot  → snapshot from GitHub Actions (X-Snapshot-Key), stored in Flights DO
//   GET /sats/:group        → CelesTrak GP JSON (whitelisted groups), cache 2 h → users never hit CelesTrak
//   GET /mp (WebSocket)     → multiplayer room (Durable Object, hibernating)
// Bodies streamed through untouched (no JSON parse → ~0 CPU).
import { DurableObject } from 'cloudflare:workers'

const SAT_GROUPS = new Set(['stations', 'visual', 'gps-ops', 'galileo', 'starlink'])
const FLIGHT_RADIUS_KM = 250
const FLIGHT_TTL_S = 20
const SNAPSHOT_STALE_S = 30 * 60 // older → { stale: true } → client simulates
const SAT_TTL_S = 7200

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
    return new Response(JSON.stringify({ error: res.status, upstream: res.headers.get('X-Upstream') }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }
  const body = await res.arrayBuffer()
  const make = (age) => new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${age}` } })
  ctx.waitUntil(Promise.all([cache.put(req, make(ttl)), cache.put(staleReq, make(staleTtl))]))
  return make(ttl)
}

const UA = () => ({ headers: { 'User-Agent': 'space-relay (fredrichegland.no portfolio)' }, signal: AbortSignal.timeout(8_000) })

// Flights: snapshot pushed by GitHub Actions (OpenSky, every ~5 min; Cloudflare IPs are blocked upstream).
// Snapshot lives in the Flights Durable Object; GET filters round the 1° cell. Edge cache 20 s per cell.
async function flights(url, ctx, env) {
  const lat = Math.round(Number(url.searchParams.get('lat')))
  const lon = Math.round(Number(url.searchParams.get('lon')))
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return new Response('bad', { status: 400 })
  return cached(ctx, `https://relay.cache/flights/${lat}/${lon}`, FLIGHT_TTL_S, () =>
    env.FLIGHTS.get(env.FLIGHTS.idFromName('world')).fetch(`https://flights/near?lat=${lat}&lon=${lon}`)
  )
}

async function flightSnapshot(request, env) {
  // Trim: secrets piped via echo carry a newline.
  const key = (env.SNAPSHOT_KEY ?? '').trim()
  if (!key || (request.headers.get('X-Snapshot-Key') ?? '').trim() !== key) return new Response('forbidden', { status: 403 })
  return env.FLIGHTS.get(env.FLIGHTS.idFromName('world')).fetch('https://flights/put', { method: 'POST', body: request.body })
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
    if (url.pathname === '/flights/snapshot' && request.method === 'POST') return flightSnapshot(request, env)
    if (request.method !== 'GET') return new Response('method', { status: 405 })
    if (url.pathname === '/flights') return withCors(await flights(url, ctx, env), origin)
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

// ─── Flights snapshot store ──────────────────────────────────────────────────
// One instance. Snapshot { t, ac: [[hex, call, lat, lon, altFt (−1 = ground), gsKn, trk, vrateFtMin, tPos]] }
// kept in memory, persisted in ≤ 1.9 MB chunks (SQLite value cap 2 MB) → survives eviction.
const CHUNK = 1_900_000
const KM_PER_DEG = 111.32

export class Flights extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.snap = null
  }

  async load() {
    if (this.snap) return this.snap
    const n = await this.ctx.storage.get('n')
    if (!n) return null
    const parts = await this.ctx.storage.get(Array.from({ length: n }, (_, i) => `c${i}`))
    this.snap = JSON.parse(Array.from({ length: n }, (_, i) => parts.get(`c${i}`)).join(''))
    return this.snap
  }

  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/put') {
      const text = await request.text()
      let snap
      try {
        snap = JSON.parse(text)
      } catch {
        return new Response('bad json', { status: 400 })
      }
      if (!Array.isArray(snap.ac) || typeof snap.t !== 'number') return new Response('bad shape', { status: 400 })
      const n = Math.ceil(text.length / CHUNK)
      const entries = { n }
      for (let i = 0; i < n; i += 1) entries[`c${i}`] = text.slice(i * CHUNK, (i + 1) * CHUNK)
      await this.ctx.storage.put(entries)
      this.snap = snap
      return new Response(JSON.stringify({ ok: true, aircraft: snap.ac.length }), { headers: { 'Content-Type': 'application/json' } })
    }

    // /near: readsb-shaped { ac, now, snapshot, stale }. seen_pos = age of each fix (client dead-reckons).
    const lat = Number(url.searchParams.get('lat'))
    const lon = Number(url.searchParams.get('lon'))
    const snap = await this.load()
    const nowS = Date.now() / 1000
    const head = { 'Content-Type': 'application/json' }
    if (!snap || nowS - snap.t > SNAPSHOT_STALE_S) return new Response(JSON.stringify({ ac: [], stale: true, snapshot: snap?.t ?? null }), { headers: head })
    const cosLat = Math.cos((lat * Math.PI) / 180)
    const r2 = (FLIGHT_RADIUS_KM / KM_PER_DEG) ** 2
    const ac = []
    for (const [hex, call, la, lo, alt, gs, trk, vr, tPos] of snap.ac) {
      let dLon = lo - lon
      if (dLon > 180) dLon -= 360
      if (dLon < -180) dLon += 360
      const dLat = la - lat
      if (dLat * dLat + (dLon * cosLat) ** 2 > r2) continue
      ac.push({
        hex,
        flight: call,
        lat: la,
        lon: lo,
        alt_baro: alt < 0 ? 'ground' : alt,
        alt_geom: alt < 0 ? undefined : alt,
        gs,
        track: trk,
        geom_rate: vr,
        seen_pos: Math.max(0, nowS - tPos),
      })
    }
    return new Response(JSON.stringify({ ac, now: nowS, snapshot: snap.t, stale: false }), { headers: head })
  }
}
