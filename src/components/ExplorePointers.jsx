// Explore pointers: other players (always) + main places (Sun, planets, Moon, Sgr A*, Andromeda) when off-screen.
// Off-screen → arrow on the screen edge toward the target + name · distance. On-screen players → ring + distance.
// rAF + pooled DOM (no React churn), same pattern as PlanetLabels.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { getActiveCamera } from '../three/cameraRuntime'
import { origin } from '../three/floatingOrigin'
import { getPoiBodies, getSolarCollisionBodies } from '../three/solarSystemRuntime'
import { isExplorePaused, subscribeExplorePause } from '../three/exploreState'
import { planetFacts } from '../data/planetFacts'
import { AU_KM, LY_KM } from '../three/galaxyFrame'

const POOL = 16
const MAX_MAIN = 5 // nearest off-screen main places shown
const MAIN_BODIES = new Set(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'])
const MAIN_POIS = new Set(['bh_sgra', 'gal_m31'])
const nameByKey = Object.fromEntries(planetFacts.map((p) => [p.key, p.name]))

const NB = [0, 1, 2].map((d) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: d }))
const nb = (n, d = 0) => NB[d].format(n)
function fmt(km) {
  if (km < 1) return `${nb(km * 1000)} m`
  if (km < 100) return `${nb(km, 1)} km`
  if (km < 1e7) return `${nb(km)} km`
  if (km < 2000 * AU_KM) return `${nb(km / AU_KM, km < 10 * AU_KM ? 2 : 0)} AU`
  if (km < 1e6 * LY_KM) return `${nb(km / LY_KM, km < 100 * LY_KM ? 1 : 0)} ly`
  return `${nb(km / LY_KM / 1e6, 2)} Mly`
}

const _v = new THREE.Vector3()

export default function ExplorePointers() {
  const paused = useSyncExternalStore(subscribeExplorePause, isExplorePaused, isExplorePaused)
  const poolRef = useRef([])

  useEffect(() => {
    if (paused) return undefined
    let frameId
    const tick = () => {
      frameId = requestAnimationFrame(tick)
      const cam = getActiveCamera()
      if (!cam) return
      const W = window.innerWidth
      const H = window.innerHeight
      const phone = W < 768 || H < 500
      const m = phone ? 22 : 34 // edge inset px
      const tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
      const tanX = tanY * cam.aspect

      const targets = []
      getPoiBodies().forEach((p) => {
        if (p.kind === 'player') targets.push({ key: p.key, name: p.name, pos: p.position, player: true, radius: 0 })
        else if (MAIN_POIS.has(p.key)) targets.push({ key: p.key, name: p.name, pos: p.position, player: false, radius: p.radius ?? 0 })
      })
      getSolarCollisionBodies().forEach((b) => {
        if (b.kind === 'body' && MAIN_BODIES.has(b.key)) targets.push({ key: b.key, name: nameByKey[b.key] ?? b.key, pos: b.position, player: false, radius: b.radius })
      })

      const items = []
      for (const t of targets) {
        const dist = Math.hypot(t.pos.x - origin.x, t.pos.y - origin.y, t.pos.z - origin.z)
        if (!t.player && dist < t.radius * 3) continue // at/inside it already
        _v.set(t.pos.x - origin.x, t.pos.y - origin.y, t.pos.z - origin.z).transformDirection(cam.matrixWorldInverse)
        const front = _v.z < 0
        const nx = front ? _v.x / -_v.z / tanX : 0
        const ny = front ? _v.y / -_v.z / tanY : 0
        const sx = W / 2 + (nx * W) / 2
        const sy = H / 2 - (ny * H) / 2
        const onScreen = front && sx > m && sx < W - m && sy > m && sy < H - m
        if (onScreen && !t.player) continue // main places on-screen: labels already
        items.push({ t, dist, onScreen, sx, sy, dx: _v.x, dy: _v.y })
      }
      // Players first, then nearest main places (capped).
      const players = items.filter((i) => i.t.player)
      const main = items.filter((i) => !i.t.player).sort((a, b) => a.dist - b.dist).slice(0, MAX_MAIN)
      const shown = [...players, ...main].slice(0, POOL)

      const placed = [] // edge points so far → nudge overlapping arrows apart along the edge
      poolRef.current.forEach((el, k) => {
        const it = shown[k]
        if (!el) return
        if (!it) {
          if (el.style.opacity !== '0') el.style.opacity = '0'
          return
        }
        const label = el.querySelector('[data-label]')
        const arrow = el.querySelector('[data-arrow]')
        const ring = el.querySelector('[data-ring]')
        const text = it.onScreen ? fmt(it.dist) : `${it.t.name} · ${fmt(it.dist)}` // on-screen: name already labelled
        if (label.textContent !== text) label.textContent = text
        el.dataset.player = it.t.player ? '1' : '0'
        let x = it.sx
        let y = it.sy
        if (it.onScreen) {
          arrow.style.display = 'none'
          ring.style.display = 'block'
        } else {
          // Edge point along screen-space direction to target (behind → same lateral direction).
          let dx = it.dx
          let dy = -it.dy
          const l = Math.hypot(dx, dy) || 1
          dx /= l
          dy = l > 1e-9 ? dy / l : 1
          const s = Math.min((W / 2 - m) / Math.max(Math.abs(dx), 1e-6), (H / 2 - m) / Math.max(Math.abs(dy), 1e-6))
          x = W / 2 + dx * s
          y = H / 2 + dy * s
          const sideEdge = Math.abs(x - W / 2) > Math.abs(y - H / 2) * (W / H)
          for (let n = 0; n < 6 && placed.some((q) => Math.abs(q[0] - x) < 90 && Math.abs(q[1] - y) < 16); n += 1) {
            if (sideEdge) y = Math.min(H - m, y + 18)
            else x = Math.min(W - m, x + 96)
          }
          placed.push([x, y])
          arrow.style.display = 'block'
          ring.style.display = 'none'
          arrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`
          // Label tucked toward screen center so it stays readable.
          label.style.transform = `translate(${-dx * 14 - 50 * (1 + dx)}%, ${dy > 0.6 ? '-160%' : dy < -0.6 ? '60%' : '-50%'})`
        }
        if (it.onScreen) label.style.transform = 'translate(-50%, 70%)'
        el.style.transform = `translate(${x}px, ${y}px)`
        el.style.opacity = it.t.player ? '1' : '0.6'
      })
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [paused])

  if (paused) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[31] overflow-hidden" aria-hidden="true">
      {Array.from({ length: POOL }, (_, i) => (
        <div
          key={i}
          ref={(el) => (poolRef.current[i] = el)}
          className="group absolute left-0 top-0 text-cyan-100 data-[player='1']:text-teal-300"
          style={{ opacity: 0 }}
        >
          <svg data-arrow viewBox="0 0 20 20" className="absolute -left-2.5 -top-2.5 h-5 w-5 drop-shadow-[0_0_6px_rgba(0,0,0,0.8)]" style={{ display: 'none' }}>
            <path d="M18 10 L4 3 L7 10 L4 17 Z" fill="currentColor" />
          </svg>
          <div data-ring className="absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-current shadow-[0_0_10px_currentColor]" style={{ display: 'none' }} />
          <p
            data-label
            className="absolute left-0 top-0 whitespace-nowrap text-[0.6rem] font-semibold uppercase tracking-[0.14em] md:text-[0.66rem]"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.7)' }}
          />
        </div>
      ))}
    </div>
  )
}
