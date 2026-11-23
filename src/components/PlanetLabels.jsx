// Screen-space HUD labels: solar bodies + POIs (named stars, ...). Explore only.
// rAF loop, direct DOM mutation (no React churn). Positions: world km - floating origin.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { getPoiBodies, getSolarCollisionBodies, subscribePoiBodies } from '../three/solarSystemRuntime'
import { origin } from '../three/floatingOrigin'
import { planetFacts } from '../data/planetFacts'
import { spaceConfig } from '../three/spaceConfig'

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
const NAME_HIDE_START = 0.3 // × viewport height, disc radius
const NAME_HIDE_END = 0.55
const RANGE_FADE = 0.25     // last fraction of labelRange fades
const FACTS_FULL_FACTOR = 5 // × radius (or factsRange × 0.4)
const FACTS_SHOW_FACTOR = 12

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function Label({ item, register }) {
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
        className="absolute bottom-full left-1/2 mb-1.5 w-max max-w-[280px] -translate-x-1/2 rounded-xl border border-cyan-400/20 bg-slate-950/72 px-3 py-2 text-left backdrop-blur-md"
        style={{ opacity: 0, visibility: 'hidden' }}
      >
        {item.facts.map((fact, i) => (
          <p key={i} className="text-[0.72rem] leading-[1.6] text-cyan-100/85">
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

  const register = (key, el) => {
    if (el) elementsRef.current.set(key, { el, factsEl: el.querySelector('[data-facts]') })
    else elementsRef.current.delete(key)
  }

  useEffect(() => {
    if (!isExplore) return undefined

    const rel = new THREE.Vector3()
    const vec = new THREE.Vector3()
    const forward = new THREE.Vector3()
    let frameId

    const place = (body, w, h, focalPx) => {
      const refs = elementsRef.current.get(body.key)
      if (!refs) return
      const { el, factsEl } = refs
      const hide = () => {
        if (el.style.opacity !== '0') el.style.opacity = '0'
      }

      rel.subVectors(body.position, origin)
      const dist = rel.length()
      const range = body.labelRange ?? Infinity
      if (rel.dot(forward) <= 0 || dist > range) return hide()
      const extra = body.labelVisibility ? body.labelVisibility(dist) : 1
      if (extra <= 0.001) return hide()

      vec.copy(rel).project(camera())
      const radiusPx = (body.radius / dist) * focalPx
      const sx = (vec.x * 0.5 + 0.5) * w
      const sy = (-vec.y * 0.5 + 0.5) * h - radiusPx - 6
      if (sx < -120 || sx > w + 120 || sy < -120 || sy > h + 120) return hide()
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`

      const rangeFade = Number.isFinite(range) ? 1 - smoothstep(range * (1 - RANGE_FADE), range, dist) : 1
      const sizeFade = 1 - smoothstep(NAME_HIDE_START * h, NAME_HIDE_END * h, radiusPx)
      el.style.opacity = (rangeFade * sizeFade * extra).toFixed(3)

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

      const w = renderer.domElement.clientWidth
      const h = renderer.domElement.clientHeight
      const focalPx = h / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
      cam.getWorldDirection(forward)
      getSolarCollisionBodies().forEach((body) => place(body, w, h, focalPx))
      getPoiBodies().forEach((body) => place(body, w, h, focalPx))
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [isExplore, cameraRef, rendererRef])

  if (!isExplore) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
      {solarLabels.map((item) => (
        <Label key={item.key} item={item} register={register} />
      ))}
      {pois.map((item) => (
        <Label key={item.key} item={item} register={register} />
      ))}
    </div>
  )
}
