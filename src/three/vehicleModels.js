// Low-poly vehicle models (multiplayer plane). Unit length 1 along +x (bow / nose), +y up, +z starboard.
// Flat-shaded, non-indexed, vertex colors (grey levels → × per-instance color). Built once, shared.
import * as THREE from 'three'

// Convex-ish part: two loops (same count) joined by quads + capped. Normals flipped outward from part center.
function prism(out, a, b, color) {
  const pts = [...a, ...b]
  const c = pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / pts.length)
  const tri = (p, q, r) => {
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]
    const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]]
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const l = Math.hypot(...n)
    if (l < 1e-9) return
    n = n.map((x) => x / l)
    const m = [(p[0] + q[0] + r[0]) / 3 - c[0], (p[1] + q[1] + r[1]) / 3 - c[1], (p[2] + q[2] + r[2]) / 3 - c[2]]
    const flip = n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0
    const vs = flip ? [p, r, q] : [p, q, r]
    if (flip) n = n.map((x) => -x)
    for (const s of vs) {
      out.pos.push(...s)
      out.nor.push(...n)
      out.col.push(...color)
    }
  }
  const k = a.length
  for (let i = 0; i < k; i += 1) {
    const j = (i + 1) % k
    tri(a[i], a[j], b[j])
    tri(a[i], b[j], b[i])
  }
  for (let i = 1; i < k - 1; i += 1) {
    tri(a[0], a[i], a[i + 1])
    tri(b[0], b[i], b[i + 1])
  }
}

const box = (out, x0, x1, y0, y1, z0, z1, color) =>
  prism(
    out,
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
    color
  )

function toGeometry(out) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3))
  g.computeBoundingSphere()
  return g
}

const HULL = [0.32, 0.32, 0.34]
const DECK = [0.62, 0.6, 0.56]
const WHITE = [0.95, 0.95, 0.95]
const WINDOW = [0.12, 0.14, 0.18]

let plane = null
/** Airliner: fuselage, swept wings, tailplane, fin, 2 engines. Unit length (span ≈ 0.95). */
export function getPlaneGeometry() {
  if (plane) return plane
  const out = { pos: [], nor: [], col: [] }
  const r = 0.045
  const ring = (x, s) => Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2
    return [x, Math.cos(a) * r * s, Math.sin(a) * r * s]
  })
  prism(out, ring(-0.42, 0.55), ring(0.38, 1), WHITE) // body
  prism(out, ring(0.38, 1), ring(0.5, 0.25), WHITE) // nose
  prism(out, ring(-0.5, 0.15), ring(-0.42, 0.55), WHITE) // tail cone
  // Wings (swept, thin).
  for (const s of [-1, 1]) {
    const w = [[0.12, -0.01, 0], [-0.06, -0.01, 0], [-0.2, -0.01, s * 0.47], [-0.13, -0.01, s * 0.47]]
    prism(out, w, w.map(([x, , z]) => [x, 0.005, z]), DECK)
    const t = [[-0.36, 0.01, 0], [-0.46, 0.01, 0], [-0.5, 0.01, s * 0.17], [-0.45, 0.01, s * 0.17]]
    prism(out, t, t.map(([x, , z]) => [x, 0.02, z]), DECK)
    box(out, -0.02, 0.1, -0.06, -0.025, s * 0.15 - 0.022, s * 0.15 + 0.022, HULL) // engine
  }
  // Fin.
  const fin = [[-0.34, 0.03, -0.006], [-0.48, 0.03, -0.006], [-0.5, 0.19, -0.006], [-0.44, 0.19, -0.006]]
  prism(out, fin, fin.map(([x, y]) => [x, y, 0.006]), WHITE)
  plane = toGeometry(out)
  return plane
}
