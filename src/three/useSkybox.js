// Loads a stitched cube skybox and sets scene.background.
import { useEffect } from 'react'
import * as THREE from 'three'
import { spaceConfig } from './spaceConfig'
import skyBk from '../assets/Pictures/SkyBox/kurt/space_ft_1536.jpg'
import skyDn from '../assets/Pictures/SkyBox/kurt/space_dn_1536.jpg'
import skyFt from '../assets/Pictures/SkyBox/kurt/space_bk_1536.jpg'
import skyLf from '../assets/Pictures/SkyBox/kurt/space_lf_1536.jpg'
import skyRt from '../assets/Pictures/SkyBox/kurt/space_rt_1536.jpg'
import skyUp from '../assets/Pictures/SkyBox/kurt/space_up_1536.jpg'

function normalizeQuarterTurns(value) {
  const turns = Number.isFinite(value) ? value : 4
  return ((Math.round(turns) % 4) + 4) % 4
}

function imageToCanvas(image, quarterTurns) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })

  switch (quarterTurns) {
    case 1:
      context.translate(canvas.width, 0)
      context.rotate(Math.PI / 2)
      break
    case 2:
      context.translate(canvas.width, canvas.height)
      context.rotate(Math.PI)
      break
    case 3:
      context.translate(0, canvas.height)
      context.rotate(-Math.PI / 2)
      break
    default:
      break
  }

  context.drawImage(image, 0, 0)
  return { canvas, context }
}

function blendVerticalSeam(faceA, edgeA, faceB, edgeB, blendPx) {
  const width = Math.min(faceA.canvas.width, faceB.canvas.width)
  const height = Math.min(faceA.canvas.height, faceB.canvas.height)
  const strip = Math.min(blendPx, Math.floor(width / 8))
  if (strip <= 0) return

  const imageDataA = faceA.context.getImageData(0, 0, faceA.canvas.width, faceA.canvas.height)
  const imageDataB = faceB.context.getImageData(0, 0, faceB.canvas.width, faceB.canvas.height)
  const dataA = imageDataA.data
  const dataB = imageDataB.data

  for (let y = 0; y < height; y += 1) {
    for (let offset = 0; offset < strip; offset += 1) {
      const t = strip > 1 ? offset / (strip - 1) : 1
      const xA = edgeA === 'left' ? offset : width - 1 - offset
      const xB = edgeB === 'left' ? offset : width - 1 - offset
      const indexA = (y * faceA.canvas.width + xA) * 4
      const indexB = (y * faceB.canvas.width + xB) * 4

      for (let channel = 0; channel < 3; channel += 1) {
        const valueA = dataA[indexA + channel]
        const valueB = dataB[indexB + channel]
        const shared = Math.round((valueA + valueB) * 0.5)
        dataA[indexA + channel] = Math.round(shared * (1 - t) + valueA * t)
        dataB[indexB + channel] = Math.round(shared * (1 - t) + valueB * t)
      }
    }
  }

  faceA.context.putImageData(imageDataA, 0, 0)
  faceB.context.putImageData(imageDataB, 0, 0)
}

function stitchSkyboxFaces(images, skyboxConfig) {
  const rotations = skyboxConfig.rotations || {}
  const faces = {
    rt: imageToCanvas(images.rt, normalizeQuarterTurns(rotations.rt)),
    lf: imageToCanvas(images.lf, normalizeQuarterTurns(rotations.lf)),
    up: imageToCanvas(images.up, normalizeQuarterTurns(rotations.up)),
    dn: imageToCanvas(images.dn, normalizeQuarterTurns(rotations.dn)),
    ft: imageToCanvas(images.ft, normalizeQuarterTurns(rotations.ft)),
    bk: imageToCanvas(images.bk, normalizeQuarterTurns(rotations.bk)),
  }
  const seamBlendPx = skyboxConfig.seamBlendPx ?? 32

  // Side ring: back <-> left <-> front <-> right.
  blendVerticalSeam(faces.bk, 'left', faces.lf, 'right', seamBlendPx)
  blendVerticalSeam(faces.bk, 'right', faces.rt, 'left', seamBlendPx)
  blendVerticalSeam(faces.ft, 'left', faces.rt, 'right', seamBlendPx)
  blendVerticalSeam(faces.ft, 'right', faces.lf, 'left', seamBlendPx)

  return faces
}

export function useSkybox(sceneRef) {
  const skyboxConfig = spaceConfig.skybox
  const skyboxKey = JSON.stringify(skyboxConfig)

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined

    let cancelled = false
    let texture = null

    const load = async () => {
      try {
        const loader = new THREE.ImageLoader()
        const [rt, lf, up, dn, ft, bk] = await Promise.all([
          loader.loadAsync(skyRt),
          loader.loadAsync(skyLf),
          loader.loadAsync(skyUp),
          loader.loadAsync(skyDn),
          loader.loadAsync(skyFt),
          loader.loadAsync(skyBk),
        ])

        if (cancelled) return

        const stitched = stitchSkyboxFaces({ rt, lf, up, dn, ft, bk }, skyboxConfig)
        texture = new THREE.CubeTexture([
          stitched.rt.canvas,
          stitched.lf.canvas,
          stitched.up.canvas,
          stitched.dn.canvas,
          stitched.ft.canvas,
          stitched.bk.canvas,
        ])
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
        scene.background = texture
      } catch {
        // Keep the default background if the skybox cannot be loaded.
      }
    }

    load()

    return () => {
      cancelled = true
      if (scene.background === texture) {
        scene.background = null
      }
      texture?.dispose?.()
    }
  }, [sceneRef, skyboxConfig, skyboxKey])
}
