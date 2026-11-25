// Screen-space HUD labels: solar bodies + POIs (named stars, ...). Explore only.
// rAF loop, direct DOM mutation (no React churn). Positions: world km - floating origin.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { getPoiBodies, getSolarCollisionBodies, subscribePoiBodies } from '../three/solarSystemRuntime'
import { origin } from '../three/floatingOrigin'
import { getTravelRanges } from '../three/scrollChapters'
import { planetFacts } from '../data/planetFacts'
import { spaceConfig } from '../three/spaceConfig'
import { collectEarthNames } from '../three/earthNames'

const NAME_POOL = 70
const NAME_MARK = { city: '•', mountain: '▲', landmark: '◆' }

// One label per UFO instance.
const ufoBase = planetFacts.find((p) => p.key === 'ufo')
const solarLabels = [
  ...planetFacts.filter((p) => p.key !== 'ufo'),
  ...Array.from({ length: spaceConfig.solarSystem.ufo.count }, (_, i) => ({
    ...ufoBase,
    key: `ufo_${i}`,
    name: `${ufoBase.name} ${i + 1}`,
  })),
]

// Names = nav aid, any range (unless labelRange / labelVisibility). Fade once disc fills screen.
// Focus: inside a body's atmosphere (airless: < 10 % radius) → only its surface places; stellar labels fade.
const NAME_HIDE_START = 0.3 // × viewport height, disc radius
const NAME_HIDE_END = 0.55
const RANGE_FADE = 0.25     // last fraction of labelRange fades
const SCROLL_CENTER = [0.3, 0.55] // scroll pages: label fades out from → to (× half screen) off center
const SCROLL_CARD_VH = 0.6  // scroll pages: hidden while within this × vh of a chapter (card on screen)
const FACTS_FULL_FACTOR = 5 // × radius (or factsRange × 0.4)
const FACTS_SHOW_FACTOR = 12

// Nearness 0..1 on a log scale between near and far (km) → bolder, larger, more opaque when close.
function nearness(dist, near, far) {
  const t = Math.log(Math.max(dist, near) / near) / Math.log(far / near)
  return 1 - Math.min(1, Math.max(0, t))
}
const WEIGHTS = [400, 500, 600, 700, 800]
const weightOf = (n) => WEIGHTS[Math.min(4, Math.round(n * 4))]
const viewSize = new THREE.Vector2()
// Per kind: [near, far] km (bodies: × radius).
const NEAR_RANGE = { place: [3, 3000], player: [1, 1e7], satellite: [5, 30000], ufo: [5, 30000] }

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const PLACE_MARK = { city: '●', mountain: '▲', landmark: '◆', crater: '○', site: '✦' }

function PlaceLabel({ item, register }) {
  const region = item.placeKind === 'region' || item.placeKind === 'water'
  return (
    <div ref={(el) => register(item.key, el)} className="absolute left-0 top-0 select-none" style={{ opacity: 0 }}>
      <p
        className={`whitespace-nowrap text-center ${
          region
            ? 'text-[0.7rem] font-light uppercase tracking-[0.45em] text-white/70'
            : 'text-[0.66rem] font-medium tracking-[0.04em] text-white/90'
        } ${item.placeKind === 'water' ? 'italic text-sky-200/70' : ''}`}
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.6)' }}
      >
        {PLACE_MARK[item.placeKind] ? <span className="mr-1 text-[0.5rem] text-amber-200/90">{PLACE_MARK[item.placeKind]}</span> : null}
        {item.name}
      </p>
      {item.facts.length ? (
        <div
          data-facts
          className="absolute bottom-full left-1/2 mb-1 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5 text-left backdrop-blur-md"
          style={{ opacity: 0, visibility: 'hidden' }}
        >
          {item.facts.map((fact, i) => (
            <p key={i} className="text-[0.66rem] leading-[1.5] text-white/85">
              {fact}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Label({ item, register }) {
  if (item.kind === 'place') return <PlaceLabel item={item} register={register} />
  return (
    <div ref={(el) => register(item.key, el)} className="absolute left-0 top-0 select-none" style={{ opacity: 0 }}>
      {/* Name — glowing halo text, always faces camera (HTML overlay) */}
      <p
        className="whitespace-nowrap text-center text-[0.58rem] font-semibold uppercase tracking-[0.32em] text-cyan-200"
        style={{
          textShadow: '0 0 6px rgba(148,162,249,1), 0 0 18px rgba(148,162,249,0.6), 0 0 32px rgba(148,162,249,0.25)',
        }}
      >
        · {item.name} ·
      </p>

      {/* Facts — close range only. Out of flow, above name → name stays pinned to body */}
      <div
        data-facts
        className="absolute bottom-full left-1/2 mb-1.5 w-max max-w-[190px] -translate-x-1/2 rounded-xl border border-cyan-400/20 bg-slate-950/72 px-2.5 py-1.5 text-left backdrop-blur-md md:max-w-[280px] md:px-3 md:py-2 phone:max-w-[190px] phone:px-2.5 phone:py-1.5"
        style={{ opacity: 0, visibility: 'hidden' }}
      >
        {item.facts.map((fact, i) => (
          <p key={i} className="text-[0.62rem] leading-[1.5] text-cyan-100/85 md:text-[0.72rem] md:leading-[1.6] phone:text-[0.62rem] phone:leading-[1.5]">
            {fact}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function PlanetLabels({ cameraRef, rendererRef, isExplore }) {
  const pois = useSyncExternalStore(subscribePoiBodies, getPoiBodies, getPoiBodies)
  const elementsRef = useRef(new Map()) // key → { el, factsEl }
  const poolRef = useRef([]) // dense Earth names: reused label elements

  const register = (key, el) => {
    if (el) elementsRef.current.set(key, { el, factsEl: el.querySelector('[data-facts]'), nameEl: el.querySelector('p') })
    else elementsRef.current.delete(key)
  }

  // Scroll pages: only scrollLabel POIs (sightings, e.g. the comet). Explore: everything.
  const scrollOnly = !isExplore
  const shown = scrollOnly ? pois.filter((p) => p.scrollLabel) : pois
  const hasLabels = !scrollOnly || shown.length > 0

  useEffect(() => {
    if (!hasLabels) return undefined

    const rel = new THREE.Vector3()
    const vec = new THREE.Vector3()
    const forward = new THREE.Vector3()
    let frameId

    const focus = { key: null, f: 0 }
    const updateFocus = () => {
      focus.key = null
      focus.f = 0
      getSolarCollisionBodies().forEach((body) => {
        if (body.kind !== 'body') return
        const range = body.atmosphere ? body.atmosphere.height : body.radius * 0.1
        const alt = Math.hypot(origin.x - body.position.x, origin.y - body.position.y, origin.z - body.position.z) - body.radius
        const f = 1 - smoothstep(range * 0.8, range * 1.6, alt)
        if (f > focus.f) {
          focus.f = f
          focus.key = body.key
        }
      })
    }

    const place = (body, w, h, focalPx, gate = 1) => {
      const refs = elementsRef.current.get(body.key)
      if (!refs) return
      const { el, factsEl, nameEl } = refs
      const hide = () => {
        if (el.style.opacity !== '0') el.style.opacity = '0'
      }

      rel.subVectors(body.position, origin)
      const dist = rel.length()
      const range = body.labelRange ?? Infinity
      if (rel.dot(forward) <= 0 || dist > range) return hide()
      let extra = (body.labelVisibility ? body.labelVisibility(dist) : 1) * gate
      if (!(body.bodyKey && body.bodyKey === focus.key)) extra *= 1 - focus.f
      if (extra <= 0.001) return hide()

      vec.copy(rel).project(camera())
      const radiusPx = (body.radius / dist) * focalPx
      const sx = (vec.x * 0.5 + 0.5) * w
      const sy = (-vec.y * 0.5 + 0.5) * h - radiusPx - (body.kind === 'place' ? 1 : 6)
      if (sx < -120 || sx > w + 120 || sy < -120 || sy > h + 120) return hide()
      // Scroll pages: only when looked right at (near screen center).
      if (scrollOnly) extra *= 1 - smoothstep(SCROLL_CENTER[0], SCROLL_CENTER[1], Math.hypot(sx - w / 2, sy - h / 2) / (Math.min(w, h) / 2))
      if (extra <= 0.001) return hide()
      const [nr, fr] = NEAR_RANGE[body.kind] ?? (body.radius > 0 ? [body.radius * 4, body.radius * 4000] : [1e6, 1e14])
      const n = nearness(dist, nr, fr)
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%) scale(${(0.86 + 0.3 * n).toFixed(3)})`
      const weight = String(weightOf(n))
      if (nameEl && nameEl.style.fontWeight !== weight) nameEl.style.fontWeight = weight

      const rangeFade = Number.isFinite(range) ? 1 - smoothstep(range * (1 - RANGE_FADE), range, dist) : 1
      const sizeFade = 1 - smoothstep(NAME_HIDE_START * h, NAME_HIDE_END * h, radiusPx)
      el.style.opacity = (rangeFade * sizeFade * extra * (0.6 + 0.4 * n)).toFixed(3)

      if (factsEl) {
        const factsFull = body.factsRange ? body.factsRange * 0.4 : body.radius * FACTS_FULL_FACTOR
        const factsShow = body.factsRange ?? body.radius * FACTS_SHOW_FACTOR
        const factsOpacity = dist <= factsFull ? 1 : Math.max(0, 1 - (dist - factsFull) / (factsShow - factsFull))
        factsEl.style.opacity = factsOpacity.toFixed(3)
        factsEl.style.visibility = factsOpacity > 0.02 ? 'visible' : 'hidden'
      }
    }

    const camera = () => cameraRef.current

    const tick = () => {
      frameId = requestAnimationFrame(tick)
      const cam = cameraRef.current
      const renderer = rendererRef.current
      if (!cam || !renderer) return

      // Renderer's cached CSS size (no layout read per frame).
      renderer.getSize(viewSize)
      const w = viewSize.x
      const h = viewSize.y
      const focalPx = h / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
      cam.getWorldDirection(forward)
      if (scrollOnly) {
        // Mid-travel only (no page card on screen): scroll well inside a gap, ≥ SCROLL_CARD_VH from either chapter.
        const y = window.scrollY
        const m = h * SCROLL_CARD_VH
        const gate = getTravelRanges().some(([a, b]) => y > a + m && y < b - m) ? 1 : 0
        getPoiBodies().forEach((body) => body.scrollLabel && place(body, w, h, focalPx, gate))
        return
      }
      updateFocus()
      getSolarCollisionBodies().forEach((body) => place(body, w, h, focalPx))
      getPoiBodies().forEach((body) => place(body, w, h, focalPx))

      // Dense names: only while Earth is (part of) the focus.
      const names =
        focus.key === 'earth' || focus.f < 0.5 ? collectEarthNames(cam, w, h).slice(0, NAME_POOL) : []
      const earthWeight = focus.key === 'earth' ? 1 : 1 - focus.f
      poolRef.current.forEach((el, i) => {
        const item = names[i]
        if (!item || !el) {
          if (el && el.style.opacity !== '0') el.style.opacity = '0'
          return
        }
        const text = (NAME_MARK[item.kind] ? NAME_MARK[item.kind] + ' ' : '') + item.name
        if (el.textContent !== text) el.textContent = text
        // Same-value attribute writes still dirty style → write on change only.
        if (el.dataset.kind !== item.kind) el.dataset.kind = item.kind
        const title = item.title ?? ''
        if (el.title !== title) el.title = title
        // Close names: bolder + bigger (2 km → 400 km log scale).
        const n = item.dist === undefined ? 0.5 : nearness(item.dist, 2, 400)
        el.style.transform = `translate(${item.x}px, ${item.y}px) translate(-50%, -100%) scale(${(0.88 + 0.3 * n).toFixed(3)})`
        const weight = String(weightOf(n))
        if (el.style.fontWeight !== weight) el.style.fontWeight = weight
        el.style.opacity = (item.opacity * earthWeight * (0.6 + 0.4 * n)).toFixed(3)
      })
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [hasLabels, scrollOnly, cameraRef, rendererRef])

  if (!hasLabels) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
      {!scrollOnly && solarLabels.map((item) => (
        <Label key={item.key} item={item} register={register} />
      ))}
      {shown.map((item) => (
        <Label key={item.key} item={item} register={register} />
      ))}
      {!scrollOnly && Array.from({ length: NAME_POOL }, (_, i) => (
        <p
          key={`name_${i}`}
          ref={(el) => (poolRef.current[i] = el)}
          className="absolute left-0 top-0 select-none whitespace-nowrap text-[0.62rem] font-medium tracking-[0.03em] text-white/85 data-[kind=water]:italic data-[kind=water]:text-sky-200/75 data-[kind=region]:uppercase data-[kind=region]:tracking-[0.3em] data-[kind=region]:text-white/65"
          style={{ opacity: 0, textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' }}
        />
      ))}
    </div>
  )
}
