// Fullscreen fade for wormhole transit (see wormholeRuntime). Drawn last, only when visible.
import * as THREE from 'three'
import { wormholeOverlay } from './wormholeRuntime'

const FLASH = new THREE.Color(0xdce0f8) // lavender-white glare

export function createFadeOverlay() {
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  // Clip-space quad: identity camera.
  const scene = new THREE.Scene()
  scene.add(quad)
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)
  const black = new THREE.Color(0x000000)

  const render = (renderer) => {
    const { alpha, flash } = wormholeOverlay()
    if (alpha < 0.002) return
    material.opacity = alpha
    material.color.copy(black).lerp(FLASH, flash)
    renderer.setRenderTarget(null)
    renderer.render(scene, camera)
  }

  const dispose = () => {
    material.dispose()
    quad.geometry.dispose()
  }

  return { render, dispose }
}
