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

// Each plate in a stop's "cluster" sits at its own angle along the actual
// railroad curve (title first, then each section in travel order) instead of
// all stacking at one point — so they're naturally strung out along the fixed
// path itself, not just nudged sideways from a single spot. The loop's
// tightest stop-to-stop gap is ~0.28 rad, so keep well under that.
const ANGLE_STEP = 0.045

// These are true 3D objects, so "distance" drives real perspective size as
// well as opacity — cards read clearly up close and shrink/fade with range.
const FULL_DISTANCE = 45
const FADE_DISTANCE = 170

const cardsByPath = new Map(profile.flythroughCards.map((card) => [card.path, card]))

function plateAtAngle(stop, angle) {
  const base = orbitPos(angle, stop.heightOffset)
  const toCenter = new THREE.Vector3(orbit.center.x - base.x, 0, orbit.center.z - base.z).normalize()
  // The camera stays further out than the plate and always looks inward
  // toward the sun, so the readable front face has to point outward — back
  // toward the flight path — not inward toward the sun. Fixed once per
  // plate, not recomputed from the camera's actual position each frame.
  const yaw = Math.atan2(-toCenter.x, -toCenter.z)
  const position = new THREE.Vector3(
    base.x + toCenter.x * OFFSET_INWARD,
    base.y + OFFSET_UP,
    base.z + toCenter.z * OFFSET_INWARD
  )
  return { position, yaw }
}

function buildPlates() {
  const plates = []

  pageStops.forEach((stop) => {
    const card = cardsByPath.get(stop.path)
    if (!card) return

    const titlePose = plateAtAngle(stop, stop.angle)
    plates.push({
      id: `${stop.path}-title`,
      path: stop.path,
      kind: 'title',
      title: card.title,
      position: titlePose.position,
      yaw: titlePose.yaw,
    })

    card.sections.forEach((section, index) => {
      const pose = plateAtAngle(stop, stop.angle - (index + 1) * ANGLE_STEP)
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
  if (plate.kind === 'title') {
    return (
      <div className="w-[21px] select-none rounded-[2px] border border-cyan-300/30 bg-slate-950/55 px-[2px] py-[1px] text-center shadow-[0_2px_5px_rgba(8,15,35,0.5)] backdrop-blur-sm">
        <p className="text-[2px] font-semibold uppercase leading-tight tracking-[0.04em] text-cyan-100">{plate.title}</p>
      </div>
    )
  }

  return (
    <div className="w-[33px] select-none rounded-[2px] border border-cyan-300/25 bg-slate-950/50 px-[3px] py-[2px] text-left shadow-[0_2px_5px_rgba(8,15,35,0.5)] backdrop-blur-sm">
      <p className="text-[2px] font-semibold uppercase tracking-[0.05em] text-cyan-300/80">{plate.section.heading}</p>
      <ul className="mt-[1px] space-y-[1px]">
        {plate.section.lines.map((line) => (
          <li key={line} className="text-[2px] leading-[1.3] text-slate-100/88">
            {line}
          </li>
        ))}
      </ul>
      {plate.cta ? (
        <Link
          to={plate.path}
          className="mt-[1px] inline-flex text-[2px] font-semibold text-cyan-200 transition hover:text-cyan-100"
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
