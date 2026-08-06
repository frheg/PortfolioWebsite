// FlythroughCards — small transparent plates fixed in 3D space near each
// flythrough stop, rendered with CSS3DRenderer so they have a real position
// AND rotation (not screen-space billboards). Each stop gets a cluster of a
// title plate plus one plate per content section — a condensed stand-in for
// that page's full content, not just a teaser — sized to be fully readable
// as the camera passes. Plates are single-sided React content on a rotated
// DOM element with no backface-visibility rule, so the default browser
// behavior shows the same content mirrored when viewed from behind.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { Link } from 'react-router-dom'
import { spaceConfig } from '../three/spaceConfig'
import { orbitPos } from '../three/useScrollCamera'
import profile from '../data/profile.json'

const { pageStops, orbit } = spaceConfig.camera

// Plates can't sit exactly on the camera's own flight path (the camera would
// be standing on top of them). Nudge each one inward — toward the sun, which
// is the direction the camera always looks — and up, so it reads as a
// distinct place the camera approaches and passes, not a point under its feet.
const OFFSET_INWARD = 34
const OFFSET_UP = 16

// Each plate in a stop's "cluster" sits at its own point along the actual
// railroad curve (title first, then each section in travel order) instead of
// all stacking together — naturally strung out along the fixed path itself.
// The tightest stop's own segment (Chat, before it wraps back to Home) is
// ~0.28 rad with only 2 sections, so 0.09 rad/step stays safely inside it.
// A zigzag in height adds separation on a second axis ("over", not "behind")
// without eating further into that angular budget. Deliberately no
// depth/inward zigzag — that would stack plates in front of/behind each
// other from the camera's view, which reads as confusing for flat cards.
const ANGLE_STEP = 0.09
const ZIGZAG_UP = 26

// These are true 3D objects, so "distance" drives real perspective size as
// well as opacity. A wider, more gradual range (vs. a tight near-field pop-in)
// avoids a steep scale gradient near the camera, which was reading as jitter.
const FULL_DISTANCE = 40
const FADE_DISTANCE = 110

const cardsByPath = new Map(profile.flythroughCards.map((card) => [card.path, card]))

function plateAtAngle(stop, angle, zigzagIndex = 0) {
  const base = orbitPos(angle, stop.heightOffset)
  const toCenter = new THREE.Vector3(orbit.center.x - base.x, 0, orbit.center.z - base.z).normalize()
  // The camera stays further out than the plate and always looks inward
  // toward the sun, so the readable front face has to point outward — back
  // toward the flight path — not inward toward the sun. Fixed once per
  // plate, not recomputed from the camera's actual position each frame.
  const yaw = Math.atan2(-toCenter.x, -toCenter.z)
  const zigzagSign = zigzagIndex % 2 === 0 ? 1 : -1
  const up = OFFSET_UP + zigzagSign * ZIGZAG_UP
  const position = new THREE.Vector3(
    base.x + toCenter.x * OFFSET_INWARD,
    base.y + up,
    base.z + toCenter.z * OFFSET_INWARD
  )
  return { position, yaw }
}

function buildPlates() {
  const plates = []

  pageStops.forEach((stop) => {
    const card = cardsByPath.get(stop.path)
    if (!card) return

    const titlePose = plateAtAngle(stop, stop.angle, 0)
    plates.push({
      id: `${stop.path}-title`,
      path: stop.path,
      kind: 'title',
      title: card.title,
      position: titlePose.position,
      yaw: titlePose.yaw,
    })

    card.sections.forEach((section, index) => {
      const pose = plateAtAngle(stop, stop.angle - (index + 1) * ANGLE_STEP, index + 1)
      plates.push({
        id: `${stop.path}-section-${index}`,
        path: stop.path,
        kind: 'section',
        section,
        cta: index === card.sections.length - 1 ? card.cta : null,
        position: pose.position,
        yaw: pose.yaw,
      })
    })
  })

  return plates
}

const plates = buildPlates()

function PlateContent({ plate }) {
  // Sized directly at the final footprint, with no extra nested transform —
  // stacking a static CSS scale() inside the CSS3D-driven transform chain
  // was adding a second composited transform layer that some browsers
  // rendered as jittery/soft. One transform (position + rotation, owned by
  // CSS3DObject) per plate is simpler and renders more predictably.
  if (plate.kind === 'title') {
    return (
      <div className="w-8 select-none rounded-[3px] border border-cyan-300/30 bg-slate-950/55 px-1 py-0.5 text-center shadow-[0_2px_6px_rgba(8,15,35,0.5)] backdrop-blur-sm">
        <p className="text-[8px] font-semibold uppercase leading-tight tracking-[0.04em] text-cyan-100">{plate.title}</p>
      </div>
    )
  }

  return (
    <div className="w-[52px] select-none rounded-[3px] border border-cyan-300/25 bg-slate-950/50 px-1.5 py-1 text-left shadow-[0_2px_6px_rgba(8,15,35,0.5)] backdrop-blur-sm">
      <p className="text-[6.5px] font-semibold uppercase tracking-[0.05em] text-cyan-300/80">{plate.section.heading}</p>
      <ul className="mt-0.5 space-y-[1px]">
        {plate.section.lines.map((line) => (
          <li key={line} className="text-[6.5px] leading-[1.3] text-slate-100/88">
            {line}
          </li>
        ))}
      </ul>
      {plate.cta ? (
        <Link
          to={plate.path}
          className="mt-0.5 inline-flex text-[6.5px] font-semibold text-cyan-200 transition hover:text-cyan-100"
        >
          {plate.cta} →
        </Link>
      ) : null}
    </div>
  )
}

export default function FlythroughCards({ cameraRef, rendererRef, active }) {
  const wrapperRef = useRef(null)
  const [mounted, setMounted] = useState([])

  useEffect(() => {
    if (!active) return undefined

    const container = wrapperRef.current
    if (!container) return undefined

    const cssRenderer = new CSS3DRenderer()
    cssRenderer.domElement.style.position = 'absolute'
    cssRenderer.domElement.style.top = '0'
    cssRenderer.domElement.style.left = '0'
    cssRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(cssRenderer.domElement)

    const scene = new THREE.Scene()
    const objects = plates.map((plate) => {
      const el = document.createElement('div')
      const object = new CSS3DObject(el)
      object.position.copy(plate.position)
      object.rotation.y = plate.yaw
      scene.add(object)
      return { plate, object, el }
    })

    setMounted(objects.map(({ plate, el }) => ({ plate, el })))

    const syncSize = () => {
      const renderer = rendererRef.current
      if (!renderer) return
      const { width, height } = cssRenderer.getSize()
      const w = renderer.domElement.clientWidth
      const h = renderer.domElement.clientHeight
      if (width !== w || height !== h) cssRenderer.setSize(w, h)
    }

    window.addEventListener('resize', syncSize)

    let frameId
    const tick = () => {
      const camera = cameraRef.current
      if (camera) {
        syncSize()

        objects.forEach(({ object, el }) => {
          const dist = camera.position.distanceTo(object.position)
          const opacity =
            dist <= FULL_DISTANCE ? 1 : Math.max(0, 1 - (dist - FULL_DISTANCE) / (FADE_DISTANCE - FULL_DISTANCE))
          el.style.opacity = opacity.toFixed(3)
          el.style.pointerEvents = opacity > 0.15 ? 'auto' : 'none'
        })

        cssRenderer.render(scene, camera)
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', syncSize)
      container.removeChild(cssRenderer.domElement)
      setMounted([])
    }
  }, [active, cameraRef, rendererRef])

  if (!active) return null

  return (
    <div ref={wrapperRef} className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {mounted.map(({ plate, el }) => createPortal(<PlateContent plate={plate} />, el, plate.id))}
    </div>
  )
}
