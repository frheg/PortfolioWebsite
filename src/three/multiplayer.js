// Multiplayer: other explorers as ghost planes + name labels. Relay Durable Object room (worker/).
// Sim time differs per client (time warp) → positions sent in nearest body's rotating frame (frameQ),
// or heliocentric ('sun', non-rotating) outside every body's sphere. Dead reckoning + smoothing between updates.
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import { origin, trackAnchor, untrackAnchor } from './floatingOrigin'
import { getSolarCollisionBodies, setPoiGroup } from './solarSystemRuntime'
import { getPlaneGeometry } from './vehicleModels'

const cfg = spaceConfig.multiplayer
const MAX = 64
const NOSE_FIX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) // model +x → camera −z

const status = { connected: false, n: 0, name: '' }
/** HUD: { connected, n (in room incl. you), name (yours) }. */
export function getMultiplayerStatus() {
  return status
}

const bodyByKey = (key) => getSolarCollisionBodies().find((b) => b.key === key && b.kind === 'body')

// World ← frame-local.
function toWorld(f, p, out) {
  const body = f === 'sun' ? null : bodyByKey(f)
  out.copy(p)
  if (body) out.applyQuaternion(body.frameQ).add(body.position)
  return out
}

const _q = new THREE.Quaternion()
const _qi = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _s = new THREE.Vector3()
const _col = new THREE.Color(0.75, 1.1, 1.6) // > 1 → blooms slightly, stands out

export function createMultiplayer(scene) {
  const relay = spaceConfig.relay.url
  const mesh = new THREE.InstancedMesh(getPlaneGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), MAX)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.count = 0
  mesh.frustumCulled = false
  for (let i = 0; i < MAX; i += 1) mesh.setColorAt(i, _col)
  // Anchored at camera world pos (synced with final origin each frame → no 1-frame carry lag).
  const anchorWorld = new THREE.Vector3()
  trackAnchor(mesh, anchorWorld)
  scene.add(mesh)

  const players = new Map() // id → { name, f, p, q, v, at, world, qWorld, poi, fresh }
  let ws = null
  let myId = null
  let retryAt = 0
  let backoff = 5000
  let lastSend = 0
  let lastSent = null // { f, p: Vector3, q: Quaternion }
  let rosterKey = ''
  let wanted = false // intentional close → no backoff

  const syncRoster = () => {
    const key = [...players.keys()].sort().join(',')
    if (key === rosterKey) return
    rosterKey = key
    setPoiGroup('players', [...players.values()].map((pl) => pl.poi))
  }

  const onMessage = (event) => {
    let m
    try {
      m = JSON.parse(event.data)
    } catch {
      return
    }
    if (m.t === 'hi') {
      myId = m.id
      status.name = m.name
      backoff = 5000
      return
    }
    if (m.t !== 'w') return
    status.n = m.n
    const seen = new Set()
    const now = performance.now()
    for (const [id, name, f, p, q, v, age] of m.players) {
      if (id === myId) continue
      seen.add(id)
      let pl = players.get(id)
      if (!pl) {
        pl = {
          name,
          p: new THREE.Vector3(),
          q: new THREE.Quaternion(),
          v: new THREE.Vector3(),
          local: new THREE.Vector3(), // smoothed, frame-local (smoothing in world would trail moving bodies)
          qLocal: new THREE.Quaternion(),
          world: new THREE.Vector3(),
          qWorld: new THREE.Quaternion(),
          fresh: true,
          poi: { key: `player_${id}`, kind: 'player', name, position: new THREE.Vector3(), radius: 0.02, labelRange: Infinity, factsRange: 80, facts: ['Annen utforsker (live)'] },
        }
        players.set(id, pl)
      }
      if (pl.f && pl.f !== f) pl.fresh = true // frame switch → snap
      pl.f = f
      pl.poi.bodyKey = f === 'sun' ? undefined : f // label survives planet focus mode
      pl.p.fromArray(p)
      pl.q.fromArray(q)
      pl.v.fromArray(v)
      pl.at = now - age
    }
    players.forEach((_, id) => !seen.has(id) && players.delete(id))
    syncRoster()
  }

  const connect = () => {
    ws = new WebSocket(`${relay.replace(/^http/, 'ws')}/mp`)
    ws.onopen = () => {
      status.connected = true
      lastSent = null
    }
    ws.onmessage = onMessage
    ws.onclose = () => {
      status.connected = false
      status.n = 0
      ws = null
      players.clear()
      syncRoster()
      retryAt = performance.now() + (wanted ? backoff : 0)
      if (wanted) backoff = Math.min(backoff * 2, 60_000)
    }
  }

  // Own frame: nearest body (dist / radius) inside its sphere, else heliocentric.
  const ownState = (camera) => {
    let best = null
    getSolarCollisionBodies().forEach((b) => {
      if (b.kind !== 'body' || !b.frameQ || b.key === 'sun') return
      const r = origin.distanceTo(b.position) / b.radius
      if (r < cfg.soiRadii && (!best || r < best.r)) best = { b, r }
    })
    camera.getWorldQuaternion(_q)
    if (!best) return { f: 'sun', p: origin.clone(), q: _q.clone() }
    _qi.copy(best.b.frameQ).invert()
    return { f: best.b.key, p: origin.clone().sub(best.b.position).applyQuaternion(_qi), q: _qi.clone().multiply(_q) }
  }

  const send = (camera, now) => {
    const s = ownState(camera)
    const moved = !lastSent || lastSent.f !== s.f || lastSent.p.distanceToSquared(s.p) > 1e-8 || lastSent.q.angleTo(s.q) > 0.002
    const gap = now - lastSend
    if (gap < 1000 / cfg.sendHz || (!moved && gap < cfg.idleSendS * 1000)) return
    const dt = gap / 1000
    const v = lastSent && lastSent.f === s.f && dt < 2 ? s.p.clone().sub(lastSent.p).divideScalar(dt) : new THREE.Vector3()
    const r = (x) => Math.round(x * 1e4) / 1e4
    ws.send(JSON.stringify({ f: s.f, p: s.p.toArray().map(r), q: s.q.toArray().map((x) => Math.round(x * 1e5) / 1e5), v: v.toArray().map(r) }))
    lastSend = now
    lastSent = s
  }

  let prev = performance.now()
  /** explore: only connected while exploring + tab visible. */
  const update = (camera, focalPx, explore) => {
    const now = performance.now()
    const dt = Math.min((now - prev) / 1000, 0.25)
    prev = now
    const want = Boolean(relay) && explore && !document.hidden
    wanted = want
    if (!want) {
      if (ws) ws.close()
      mesh.count = 0
      return
    }
    if (!ws && now > retryAt) connect()
    if (ws?.readyState === WebSocket.OPEN && camera) send(camera, now)

    // Others: dead-reckon target, smooth toward it (snap on big jumps).
    let k = 0
    anchorWorld.copy(origin)
    const blend = 1 - Math.exp(-cfg.smoothing * dt)
    players.forEach((pl) => {
      const age = Math.min((now - pl.at) / 1000, 3)
      _v.copy(pl.v).multiplyScalar(age).add(pl.p) // dead-reckoned target, frame-local
      if (pl.fresh || pl.local.distanceTo(_v) > Math.max(50, pl.v.length() * 3)) {
        pl.local.copy(_v)
        pl.qLocal.copy(pl.q)
        pl.fresh = false
      } else {
        pl.local.lerp(_v, blend)
        pl.qLocal.slerp(pl.q, blend)
      }
      toWorld(pl.f, pl.local, pl.world)
      const body = pl.f === 'sun' ? null : bodyByKey(pl.f)
      pl.qWorld.copy(pl.qLocal)
      if (body) pl.qWorld.premultiply(body.frameQ)
      pl.poi.position.copy(pl.world)
      if (k >= MAX || !camera) return
      _v.subVectors(pl.world, anchorWorld)
      const scale = Math.max(cfg.modelKm, (_v.length() * cfg.minPx) / Math.max(focalPx, 1))
      _m.compose(_v, _q.copy(pl.qWorld).multiply(NOSE_FIX), _s.setScalar(scale))
      mesh.setMatrixAt(k, _m)
      k += 1
    })
    mesh.count = k
    mesh.instanceMatrix.needsUpdate = true
  }

  const dispose = () => {
    if (ws) {
      ws.onclose = null
      ws.close()
    }
    status.connected = false
    status.n = 0
    untrackAnchor(mesh)
    scene.remove(mesh)
    mesh.material.dispose()
    mesh.dispose()
    players.clear()
    setPoiGroup('players', [])
  }

  return { update, dispose }
}
