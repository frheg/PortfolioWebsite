// PlanetLabels — screen-space HUD labels for each solar-system body.
// Only visible in explore mode. Positions are updated every frame by a
// requestAnimationFrame loop via direct DOM mutation (no React state churn).
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getSolarCollisionBodies } from '../three/solarSystemRuntime'
import { planetFacts } from '../data/planetFacts'
import { spaceConfig } from '../three/spaceConfig'

// Expand the single 'ufo' entry in planetFacts into one entry per UFO instance
// so each craft gets its own DOM label element.
const ufoBase = planetFacts.find((p) => p.key === 'ufo')
const allPlanetFacts = [
  ...planetFacts.filter((p) => p.key !== 'ufo'),
  ...Array.from({ length: spaceConfig.solarSystem.ufo.count }, (_, i) => ({
    ...ufoBase,
    key: `ufo_${i}`,
    name: `${ufoBase.name} ${i + 1}`,
  })),
]

// Distance thresholds expressed as multiples of the body's effective radius.
// MIN_R so tiny bodies (Moon, Mercury) still have a useful visibility range.
const MIN_R = 14
const NAME_FULL_FACTOR = 5    // fully bright at this distance × eff radius
const NAME_FADE_FACTOR = 55   // invisible beyond this × eff radius
const FACTS_FULL_FACTOR = 5   // facts fully visible at this × body.radius
const FACTS_SHOW_FACTOR = 12  // facts start appearing at this × body.radius

export default function PlanetLabels({ cameraRef, rendererRef, isExplore }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isExplore) return undefined

    const vec = new THREE.Vector3()
    const bodyPos = new THREE.Vector3()
    let frameId

    const tick = () => {
      const camera = cameraRef.current
      const renderer = rendererRef.current
      const container = containerRef.current

      if (!camera || !renderer || !container) {
        frameId = requestAnimationFrame(tick)
        return
      }

      const bodies = getSolarCollisionBodies()
      const w = renderer.domElement.clientWidth
      const h = renderer.domElement.clientHeight

      bodies.forEach((body) => {
        const el = container.querySelector(`[data-planet="${body.key}"]`)
        if (!el) return

        // Project a point just above the top of the body — tighter offset than before
        vec.copy(body.position)
        vec.y += body.radius * 0.55 + 2
        vec.project(camera)

        const sx = (vec.x * 0.5 + 0.5) * w
        const sy = (-vec.y * 0.5 + 0.5) * h

        if (vec.z > 1.0 || sx < -120 || sx > w + 120 || sy < -120 || sy > h + 120) {
          el.style.opacity = '0'
          return
        }

        el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`

        bodyPos.copy(body.position)
        const dist = camera.position.distanceTo(bodyPos)
        const eff = Math.max(body.radius, MIN_R)

        // Name opacity
        const nameFull = eff * NAME_FULL_FACTOR
        const nameFade = eff * NAME_FADE_FACTOR
        const nameOpacity =
          dist <= nameFull ? 1 : Math.max(0, 1 - (dist - nameFull) / (nameFade - nameFull))
        el.style.opacity = nameOpacity.toFixed(3)

        // Facts opacity — reveals only when close
        const factsEl = el.querySelector('[data-facts]')
        if (factsEl) {
          const factsFull = body.radius * FACTS_FULL_FACTOR
          const factsShow = body.radius * FACTS_SHOW_FACTOR
          const factsOpacity =
            dist <= factsFull ? 1 : Math.max(0, 1 - (dist - factsFull) / (factsShow - factsFull))
          factsEl.style.opacity = factsOpacity.toFixed(3)
          factsEl.style.visibility = factsOpacity > 0.02 ? 'visible' : 'hidden'
        }
      })

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [isExplore, cameraRef, rendererRef])

  if (!isExplore) return null

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      {allPlanetFacts.map((planet) => (
        <div
          key={planet.key}
          data-planet={planet.key}
          className="absolute left-0 top-0 select-none"
          style={{ opacity: 0 }}
        >
          {/* Name — glowing halo text, always faces camera (HTML overlay) */}
          <p
            className="whitespace-nowrap text-center text-[0.58rem] font-semibold uppercase tracking-[0.32em] text-cyan-200"
            style={{
              textShadow:
                '0 0 6px rgba(103,232,249,1), 0 0 18px rgba(103,232,249,0.6), 0 0 32px rgba(103,232,249,0.25)',
            }}
          >
            · {planet.name} ·
          </p>

          {/* Facts — revealed when camera is very close */}
          <div
            data-facts
            className="mx-auto mt-1.5 w-max max-w-[280px] rounded-xl border border-cyan-400/20 bg-slate-950/72 px-3 py-2 text-left backdrop-blur-md"
            style={{ opacity: 0, visibility: 'hidden' }}
          >
            {planet.facts.map((fact, i) => (
              <p key={i} className="text-[0.72rem] leading-[1.6] text-cyan-100/85">
                {fact}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
