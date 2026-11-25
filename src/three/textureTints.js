// Planet/ring recolor → site palette. Pure RGBA (Uint8) in place → same code bakes KTX2 offline (scripts/build-ktx2.mjs)
// and runs live in the webp fallback.
import { Color } from 'three'

// Rings: tint per ring texture key.
export const RING_TINTS = {
  saturnRing: 0xfab387, // peach
  uranusRing: 0x89dceb, // sky
}

// Planets: hue-shift target per texture key. NASA photos → each planet its own Catppuccin hue, lightness kept (= detail).
export const PLANET_HUE_TARGETS = {
  sun: { hex: 0xfab387, strength: 0.6 }, // peach
  mercury: { hex: 0x9399b2, strength: 0.55 }, // overlay2
  venus: { hex: 0xfab387, strength: 0.55 }, // peach
  moon: { hex: 0xa6adc8, strength: 0.5 }, // subtext0
  mars: { hex: 0xeba0ac, strength: 0.55 }, // maroon
  jupiter: { hex: 0xf9e2af, strength: 0.5 }, // yellow
  saturn: { hex: 0xf5e0dc, strength: 0.5 }, // rosewater
  uranus: { hex: 0x89dceb, strength: 0.55 }, // sky
  neptune: { hex: 0x74c7ec, strength: 0.55 }, // sapphire
  pluto: { hex: 0xf2cdcd, strength: 0.5 }, // flamingo
}

// Shortest way round the hue circle (0..1).
function lerpHue(a, b, t) {
  let diff = b - a
  if (diff > 0.5) diff -= 1
  if (diff < -0.5) diff += 1
  let result = a + diff * t
  if (result < 0) result += 1
  if (result >= 1) result -= 1
  return result
}

/** Hue/sat toward targetHex by strength, lightness kept. */
export function hueShiftPixels(data, targetHex, strength) {
  const targetHsl = new Color(targetHex).getHSL({})
  const pixel = new Color()
  const hsl = {}
  for (let i = 0; i < data.length; i += 4) {
    pixel.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255)
    pixel.getHSL(hsl)
    pixel.setHSL(lerpHue(hsl.h, targetHsl.h, strength), hsl.s + (targetHsl.s - hsl.s) * strength, hsl.l)
    data[i] = Math.round(pixel.r * 255)
    data[i + 1] = Math.round(pixel.g * 255)
    data[i + 2] = Math.round(pixel.b * 255)
  }
}

/** Ring photos paint gaps dark, not transparent → flat tint, alpha from luminance (gaps see-through, bands solid). */
export function ringPixels(data, tintHex) {
  const tint = new Color(tintHex)
  const r = Math.round(tint.r * 255)
  const g = Math.round(tint.g * 255)
  const b = Math.round(tint.b * 255)
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = Math.round(Math.pow(Math.min(1, Math.max(0, luminance)), 1.4) * 255)
  }
}

/** Recolor for a texture key (no-op if none). */
export function tintPixels(key, data) {
  if (RING_TINTS[key]) ringPixels(data, RING_TINTS[key])
  else if (PLANET_HUE_TARGETS[key]) hueShiftPixels(data, PLANET_HUE_TARGETS[key].hex, PLANET_HUE_TARGETS[key].strength)
}
