// FlythroughCards — floating, screen-projected preview cards for each stop
// along the flythrough loop. Positions are updated every frame by direct
// DOM mutation (no React state churn), mirroring PlanetLabels.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Link } from 'react-router-dom'
import { spaceConfig } from '../three/spaceConfig'
import { orbitPos } from '../three/useScrollCamera'
import profile from '../data/profile.json'

const { pageStops, orbit } = spaceConfig.camera

// The flythrough ellipse has a ~150-170 unit radius, so cards fade in well
// before the camera reaches them and fade out again once it's passed.
const FULL_DISTANCE = 70
const FADE_DISTANCE = 240

// Cards can't sit exactly on the camera's own flight path (the camera would
// be standing on top of them). Nudge each one inward — toward the sun, which
// is the direction the camera always looks — and up, so it reads as a
// distinct object the camera approaches and passes, not a point under its feet.
const CARD_OFFSET_INWARD = 55
const CARD_OFFSET_UP = 22

function anchorForStop(stop) {
  const base = orbitPos(stop.angle, stop.heightOffset)
  const toCenterX = orbit.center.x - base.x
  const toCenterZ = orbit.center.z - base.z
  const len = Math.hypot(toCenterX, toCenterZ) || 1
  return new THREE.Vector3(
    base.x + (toCenterX / len) * CARD_OFFSET_INWARD,
    base.y + CARD_OFFSET_UP,
    base.z + (toCenterZ / len) * CARD_OFFSET_INWARD
  )
}

const cardsByPath = new Map(profile.flythroughCards.map((card) => [card.path, card]))
const stops = pageStops
  .map((stop) => ({ ...stop, card: cardsByPath.get(stop.path) }))
  .filter((stop) => stop.card)

export default function FlythroughCards({ cameraRef, rendererRef, isFlythrough }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isFlythrough) return undefined

    const vec = new THREE.Vector3()
    const anchors = stops.map((stop) => anchorForStop(stop))
    let frameId

    const tick = () => {
      const camera = cameraRef.current
      const renderer = rendererRef.current
      const container = containerRef.current

      if (!camera || !renderer || !container) {
        frameId = requestAnimationFrame(tick)
        return
      }

      const w = renderer.domElement.clientWidth
      const h = renderer.domElement.clientHeight

      stops.forEach((stop, index) => {
        const el = container.querySelector(`[data-flythrough-card="${stop.path}"]`)
        if (!el) return

        const anchor = anchors[index]
        vec.copy(anchor)
        vec.project(camera)

        const sx = (vec.x * 0.5 + 0.5) * w
        const sy = (-vec.y * 0.5 + 0.5) * h

        if (vec.z > 1.0 || sx < -160 || sx > w + 160 || sy < -160 || sy > h + 160) {
          el.style.opacity = '0'
          el.style.pointerEvents = 'none'
          return
        }

        el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`

        const dist = camera.position.distanceTo(anchor)
        const opacity =
          dist <= FULL_DISTANCE ? 1 : Math.max(0, 1 - (dist - FULL_DISTANCE) / (FADE_DISTANCE - FULL_DISTANCE))

        el.style.opacity = opacity.toFixed(3)
        el.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none'
      })

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [isFlythrough, cameraRef, rendererRef])

  if (!isFlythrough) return null

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
      {stops.map((stop) => (
        <div
          key={stop.path}
          data-flythrough-card={stop.path}
          className="absolute left-0 top-0 w-60 select-none"
          style={{ opacity: 0 }}
        >
          <div className="rounded-[1.2rem] border border-cyan-300/25 bg-slate-950/70 p-4 text-left shadow-[0_20px_60px_rgba(8,15,35,0.55)] backdrop-blur-md">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/75">{stop.card.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-100/88">{stop.card.blurb}</p>
            <Link
              to={stop.path}
              className="mt-3 inline-flex text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
            >
              {stop.card.cta} →
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
