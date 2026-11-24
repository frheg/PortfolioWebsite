// Flights snapshot (GitHub Actions cron, ~5 min): OpenSky /states/all (OAuth client credentials, 4 credits)
// → compact rows → POST to relay Worker (/flights/snapshot). Cloudflare IPs are blocked by ADS-B APIs; GitHub's aren't (hopefully).
// Env: OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, RELAY_URL, SNAPSHOT_KEY.
// Row: [hex, callsign, lat, lon, altFt (−1 = ground), gsKn, track, vrateFtMin, tPos (unix s)]
const { OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, RELAY_URL, SNAPSHOT_KEY } = process.env
const M_FT = 3.28084
const MS_KN = 1.943844

const need = { OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, RELAY_URL, SNAPSHOT_KEY }
const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => k)
if (missing.length) {
  console.error(`missing env: ${missing.join(', ')}`)
  process.exit(1)
}

const timeout = (ms) => AbortSignal.timeout(ms)

const tokenRes = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: OPENSKY_CLIENT_ID, client_secret: OPENSKY_CLIENT_SECRET }),
  signal: timeout(20_000),
})
if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`)
const { access_token: token } = await tokenRes.json()

const statesRes = await fetch('https://opensky-network.org/api/states/all', { headers: { Authorization: `Bearer ${token}` }, signal: timeout(60_000) })
if (!statesRes.ok) throw new Error(`states ${statesRes.status}`)
const states = await statesRes.json()
console.log(`opensky: ${states.states?.length ?? 0} states, credits left ${statesRes.headers.get('x-rate-limit-remaining')}`)

const r4 = (x) => Math.round(x * 1e4) / 1e4
const ac = []
for (const s of states.states ?? []) {
  const [hex, call, , tPos, , lon, lat, baro, ground, vel, trk, vr, , geo] = s
  if (lat === null || lon === null || tPos === null) continue
  const altM = geo ?? baro
  ac.push([
    hex,
    (call ?? '').trim(),
    r4(lat),
    r4(lon),
    ground ? -1 : altM === null ? 0 : Math.round(altM * M_FT),
    vel === null ? 0 : Math.round(vel * MS_KN),
    trk === null ? 0 : Math.round(trk),
    vr === null ? 0 : Math.round(vr * M_FT * 60),
    tPos,
  ])
}

const body = JSON.stringify({ t: states.time ?? Math.floor(Date.now() / 1000), ac })
const put = await fetch(`${RELAY_URL.replace(/\/$/, '')}/flights/snapshot`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Snapshot-Key': SNAPSHOT_KEY },
  body,
  signal: timeout(60_000),
})
console.log(`relay: ${put.status} ${await put.text()} (${(body.length / 1024).toFixed(0)} KiB)`)
if (!put.ok) process.exit(1)
