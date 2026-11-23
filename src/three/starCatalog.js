// Real nearby stars: HYG v4.1 (CC BY-SA 4.0), ≤ 1 kpc. Built by scripts/build-star-catalog.mjs.
// Static file, fetched client-side. Grid index for nearest-star queries.
import * as THREE from 'three'

const GRID_PC = 10

export async function loadStarCatalog() {
  const base = import.meta.env.BASE_URL
  const [binRes, namesRes] = await Promise.all([fetch(`${base}data/stars.bin`), fetch(`${base}data/star-names.json`)])
  if (!binRes.ok || !namesRes.ok) throw new Error('star catalog fetch failed')
  const buf = await binRes.arrayBuffer()
  const names = await namesRes.json()

  const view = new DataView(buf)
  if (String.fromCharCode(...new Uint8Array(buf, 0, 4)) !== 'STR1') throw new Error('bad star catalog')
  const count = view.getUint32(4, true)
  let o = 8
  const positions = new Float32Array(buf, o, count * 3)
  o += count * 12
  const absMag = new Float32Array(buf, o, count)
  o += count * 4
  const temp = new Uint16Array(buf, o, count)
  o += count * 2
  const color = new Uint8Array(buf, o, count * 3)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('absMag', new THREE.BufferAttribute(absMag, 1))
  geometry.setAttribute('temp', new THREE.BufferAttribute(temp, 1))
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3, true))

  const grid = new Map()
  const cellKey = (x, y, z) => `${Math.floor(x / GRID_PC)}:${Math.floor(y / GRID_PC)}:${Math.floor(z / GRID_PC)}`
  for (let i = 0; i < count; i += 1) {
    const key = cellKey(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    let list = grid.get(key)
    if (!list) grid.set(key, (list = []))
    list.push(i)
  }

  // Nearest within maxPc (≤ GRID_PC·reach). Writes into out; returns dist or Infinity.
  const nearest = (p, maxPc, out) => {
    const reach = Math.ceil(maxPc / GRID_PC)
    const cx = Math.floor(p.x / GRID_PC)
    const cy = Math.floor(p.y / GRID_PC)
    const cz = Math.floor(p.z / GRID_PC)
    let best = maxPc
    let bestIndex = -1
    for (let a = -reach; a <= reach; a += 1) {
      for (let b = -reach; b <= reach; b += 1) {
        for (let c = -reach; c <= reach; c += 1) {
          const list = grid.get(`${cx + a}:${cy + b}:${cz + c}`)
          if (!list) continue
          for (const i of list) {
            const d = Math.hypot(positions[i * 3] - p.x, positions[i * 3 + 1] - p.y, positions[i * 3 + 2] - p.z)
            if (d < best) {
              best = d
              bestIndex = i
            }
          }
        }
      }
    }
    if (bestIndex < 0) return Infinity
    out.x = positions[bestIndex * 3]
    out.y = positions[bestIndex * 3 + 1]
    out.z = positions[bestIndex * 3 + 2]
    out.absMag = absMag[bestIndex]
    out.temp = temp[bestIndex]
    out.id = `c${bestIndex}`
    return best
  }

  return { count, positions, absMag, temp, names, geometry, nearest }
}
