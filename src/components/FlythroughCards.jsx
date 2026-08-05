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
// be standing on top of them). Nudge the cluster inward — toward the sun,
// which is the direction the camera always looks — and up, so it reads as a
// distinct place the camera approaches and passes, not a point under its feet.
const CLUSTER_OFFSET_INWARD = 34
const CLUSTER_OFFSET_UP = 16
const TITLE_LIFT = 11 // extra height for the title plate above the section row
const PLATE_GAP = 12 // world-unit spacing between adjacent section plates

// These are true 3D objects now, so "distance" drives real perspective size
// as well as opacity — cards read clearly up close and shrink/fade with range.
const FULL_DISTANCE = 45
const FADE_DISTANCE = 170

const cardsByPath = new Map(profile.flythroughCards.map((card) => [card.path, card]))

function buildPlates() {
  const plates = []

  pageStops.forEach((stop) => {
    const card = cardsByPath.get(stop.path)
    if (!card) return

    const base = orbitPos(stop.angle, stop.heightOffset)
    const toCenter = new THREE.Vector3(orbit.center.x - base.x, 0, orbit.center.z - base.z).normalize()
    const tangent = new THREE.Vector3(-toCenter.z, 0, toCenter.x)

    const clusterCenter = new THREE.Vector3(
      base.x + toCenter.x * CLUSTER_OFFSET_INWARD,
      base.y + CLUSTER_OFFSET_UP,
      base.z + toCenter.z * CLUSTER_OFFSET_INWARD
    )
    // The camera stays further out than the cluster and always looks inward
    // toward the sun, so the readable front face has to point outward — back
    // toward the flight path — not inward toward the sun. Fixed once, not
    // recomputed from the camera's actual position each frame.
    const yaw = Math.atan2(-toCenter.x, -toCenter.z)

    plates.push({
      id: `${stop.path}-title`,
      path: stop.path,
      kind: 'title',
      title: card.title,
      position: clusterCenter.clone().add(new THREE.Vector3(0, TITLE_LIFT, 0)),
      yaw,
    })

    const sections = card.sections
    sections.forEach((section, index) => {
      const offset = (index - (sections.length - 1) / 2) * PLATE_GAP
      plates.push({
        id: `${stop.path}-section-${index}`,
        path: stop.path,
        kind: 'section',
        section,
        cta: index === sections.length - 1 ? card.cta : null,
        position: clusterCenter.clone().addScaledVector(tangent, offset),
        yaw,
      })
    })
  })

  return plates
}

const plates = buildPlates()

function PlateContent({ plate }) {
  if (plate.kind === 'title') {
    return (
      <div className="w-[62px] select-none rounded-md border border-cyan-300/30 bg-slate-950/55 px-1.5 py-1 text-center shadow-[0_6px_16px_rgba(8,15,35,0.5)] backdrop-blur-sm">
        <p className="text-[6px] font-semibold uppercase leading-tight tracking-[0.06em] text-cyan-100">{plate.title}</p>
      </div>
    )
  }

  return (
    <div className="w-[100px] select-none rounded-md border border-cyan-300/25 bg-slate-950/50 px-2 py-1.5 text-left shadow-[0_6px_16px_rgba(8,15,35,0.5)] backdrop-blur-sm">
      <p className="text-[5px] font-semibold uppercase tracking-[0.08em] text-cyan-300/80">{plate.section.heading}</p>
      <ul className="mt-0.5 space-y-0.5">
        {plate.section.lines.map((line) => (
          <li key={line} className="text-[5px] leading-[1.35] text-slate-100/88">
            {line}
          </li>
        ))}
      </ul>
      {plate.cta ? (
        <Link
          to={plate.path}
          className="mt-1 inline-flex text-[5px] font-semibold text-cyan-200 transition hover:text-cyan-100"
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
