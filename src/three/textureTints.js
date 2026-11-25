// Ring photo cleanup: source paints the gaps dark instead of transparent → alpha from luminance (gaps see-through,
// bands solid), colour kept. Pure RGBA (Uint8) in place → bake (scripts/build-ktx2.mjs) + live webp fallback.
// Planets: real colours, no recolouring.

export function ringAlphaFromLuminance(data) {
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
    data[i + 3] = Math.round(Math.pow(Math.min(1, Math.max(0, luminance)), 1.4) * 255)
  }
}

// Texture keys whose fallback webp still needs the live cleanup (baked ones already have alpha).
const RING_ALPHA = new Set(['uranusRing'])

/** Fallback path: fix up a texture's pixels for a key (no-op for most). */
export function tintPixels(key, data) {
  if (RING_ALPHA.has(key)) ringAlphaFromLuminance(data)
}
