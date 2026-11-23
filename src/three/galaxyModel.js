// Milky Way structure model. One source of truth for:
// - raymarched glow (GLSL mirror below, GALAXY_GLSL)
// - procedural star counts (stellarDensity, JS, worker)
// Galaxy-local frame G, kpc (see galaxyFrame.js). Pure JS, no three.

export const GALAXY = {
  bounds: { radius: 20, halfHeight: 4 },
  thinDisk: { scaleLength: 2.6, scaleHeight: 0.3 },
  thickDisk: { scaleLength: 3.6, scaleHeight: 0.9, weight: 0.12 },
  innerTaper: [1.2, 3.6], // disk fades into bar region
  outerCut: [13, 17.5],
  // 4 log-spiral arms, trailing (r = a·e^{kθ}). Arm i passes R = a·e^{-k·iπ/2} at θ = 0 (sun dir).
  // i: 0 Perseus, 1 Sagittarius-Carina, 2 Scutum-Centaurus, 3 Norma.
  // 2 major (Perseus, Scutum-Cen) + 2 minor → grand-design read from outside.
  arms: { a: 10, pitchDeg: 12.5, width: 0.4, strengths: [1, 0.4, 1, 0.4], boost: 0.8, youngScaleLength: 5 },
  orionSpur: { radius: 8.35, halfAngle: 0.4, width: 0.18, strength: 0.55 },
  bar: { angleDeg: -27, axes: [1.5, 0.55, 0.4], weight: 9 },
  nucleus: { scale: 0.12, weight: 60 },
  dust: { scaleHeight: 0.11, armShift: -0.22, width: 0.28 },
}

const ARM_K = Math.tan((GALAXY.arms.pitchDeg * Math.PI) / 180)
const BAR_ANGLE = (GALAXY.bar.angleDeg * Math.PI) / 180

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
const sech2 = (x) => {
  const c = Math.cosh(Math.min(Math.abs(x), 20))
  return 1 / (c * c)
}

// 0..1 arm proximity × strength. shift (kpc) moves ridge radially (dust lanes sit inside).
export function armField(R, theta, shift = 0, width = GALAXY.arms.width) {
  if (R < 0.5) return 0
  const { a, strengths } = GALAXY.arms
  const s = (4 * (theta - Math.log(Math.max(R - shift, 0.1) / a) / ARM_K)) / (2 * Math.PI)
  const fl = Math.floor(s)
  const f = s - fl
  const nearest = f < 0.5 ? fl : fl + 1
  const idx = ((nearest % 4) + 4) % 4
  const dAng = Math.min(f, 1 - f) * (Math.PI / 2)
  const d = R * dAng * Math.sin(Math.atan(ARM_K)) // ⟂ distance to ridge, kpc (approx)
  let field = Math.exp(-(d * d) / (2 * width * width)) * strengths[idx]

  const { radius, halfAngle, width: sw, strength } = GALAXY.orionSpur
  const wrapped = Math.atan2(Math.sin(theta), Math.cos(theta))
  const spur = Math.exp(-((R - shift - radius) ** 2) / (2 * sw * sw)) * (1 - smoothstep(halfAngle * 0.6, halfAngle, Math.abs(wrapped)))
  field = Math.max(field, spur * strength)
  return field
}

function rawDensity(x, y, z) {
  const R = Math.hypot(x, y)
  const theta = Math.atan2(y, x)
  const { thinDisk, thickDisk, innerTaper, outerCut, arms, bar, nucleus } = GALAXY
  const radial = smoothstep(innerTaper[0], innerTaper[1], R) * (1 - smoothstep(outerCut[0], outerCut[1], R))
  const thin = Math.exp(-R / thinDisk.scaleLength) * sech2(z / thinDisk.scaleHeight)
  const thick = thickDisk.weight * Math.exp(-R / thickDisk.scaleLength) * sech2(z / thickDisk.scaleHeight)
  const disk = (thin * (1 + arms.boost * armField(R, theta)) + thick) * radial

  const bx = (x * Math.cos(BAR_ANGLE) + y * Math.sin(BAR_ANGLE)) / bar.axes[0]
  const by = (-x * Math.sin(BAR_ANGLE) + y * Math.cos(BAR_ANGLE)) / bar.axes[1]
  const bz = z / bar.axes[2]
  const bulge = bar.weight * Math.exp(-2 * Math.hypot(bx, by, bz)) * 0.1
  const core = nucleus.weight * Math.exp(-Math.hypot(x, y, z) / nucleus.scale) * 0.1
  return disk + bulge + core
}

const DENSITY_AT_SUN = rawDensity(8.178, 0, 0.0208)

// Stellar number density relative to solar neighborhood (= 1 at sun).
export function stellarDensity(x, y, z) {
  return rawDensity(x, y, z) / DENSITY_AT_SUN
}

// ─── GLSL mirror ─────────────────────────────────────────────────────────────
// Emission split: old (smooth disk + bulge, warm), young (arms, blue), HII knots (pink).
// Dust: thin layer, ridge shifted inward of arms, clumpy.

const f = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`)

export const GALAXY_GLSL = /* glsl */ `
const float ARM_A = ${f(GALAXY.arms.a)};
const float ARM_K = ${f(ARM_K)};
const float ARM_SIN = ${f(Math.sin(Math.atan(ARM_K)))};
const vec4 ARM_STRENGTH = vec4(${GALAXY.arms.strengths.map(f).join(', ')});
const float BAR_C = ${f(Math.cos(BAR_ANGLE))};
const float BAR_S = ${f(Math.sin(BAR_ANGLE))};

float g_hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float g_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 fr = fract(x);
  fr = fr * fr * (3.0 - 2.0 * fr);
  return mix(mix(mix(g_hash(i), g_hash(i + vec3(1, 0, 0)), fr.x),
                 mix(g_hash(i + vec3(0, 1, 0)), g_hash(i + vec3(1, 1, 0)), fr.x), fr.y),
             mix(mix(g_hash(i + vec3(0, 0, 1)), g_hash(i + vec3(1, 0, 1)), fr.x),
                 mix(g_hash(i + vec3(0, 1, 1)), g_hash(i + vec3(1, 1, 1)), fr.x), fr.y), fr.z);
}

float g_fbm(vec3 p) {
  return g_noise(p) * 0.55 + g_noise(p * 2.13 + 7.1) * 0.3 + g_noise(p * 4.37 + 3.7) * 0.15;
}

float g_sech2(float x) {
  float c = cosh(min(abs(x), 20.0));
  return 1.0 / (c * c);
}

float g_arm(float R, float theta, float shift, float width) {
  if (R < 0.5) return 0.0;
  float s = 4.0 * (theta - log(max(R - shift, 0.1) / ARM_A) / ARM_K) / 6.2831853;
  float fl = floor(s);
  float fr = s - fl;
  float nearest = fr < 0.5 ? fl : fl + 1.0;
  int idx = int(mod(nearest, 4.0));
  float d = R * min(fr, 1.0 - fr) * 1.5707963 * ARM_SIN;
  float field = exp(-d * d / (2.0 * width * width)) * ARM_STRENGTH[idx];
  float wrapped = atan(sin(theta), cos(theta));
  float spurR = R - shift - ${f(GALAXY.orionSpur.radius)};
  float spur = exp(-spurR * spurR / ${f(2 * GALAXY.orionSpur.width ** 2)})
    * (1.0 - smoothstep(${f(GALAXY.orionSpur.halfAngle * 0.6)}, ${f(GALAXY.orionSpur.halfAngle)}, abs(wrapped)));
  return max(field, spur * ${f(GALAXY.orionSpur.strength)});
}

// rgb: emission (relative), a: dust density.
vec4 galaxySample(vec3 p) {
  float R = length(p.xy);
  float theta = atan(p.y, p.x);
  float radial = smoothstep(${f(GALAXY.innerTaper[0])}, ${f(GALAXY.innerTaper[1])}, R)
    * (1.0 - smoothstep(${f(GALAXY.outerCut[0])}, ${f(GALAXY.outerCut[1])}, R));

  float thin = exp(-R / ${f(GALAXY.thinDisk.scaleLength)}) * g_sech2(p.z / ${f(GALAXY.thinDisk.scaleHeight)});
  float thick = ${f(GALAXY.thickDisk.weight)} * exp(-R / ${f(GALAXY.thickDisk.scaleLength)}) * g_sech2(p.z / ${f(GALAXY.thickDisk.scaleHeight)});
  float arm = g_arm(R, theta, 0.0, ${f(GALAXY.arms.width)});
  float clump = g_fbm(p * 3.1);

  vec3 bq = vec3((p.x * BAR_C + p.y * BAR_S) / ${f(GALAXY.bar.axes[0])},
                 (-p.x * BAR_S + p.y * BAR_C) / ${f(GALAXY.bar.axes[1])},
                 p.z / ${f(GALAXY.bar.axes[2])});
  float bulge = ${f(GALAXY.bar.weight * 0.1)} * exp(-2.0 * length(bq));
  float core = ${f(GALAXY.nucleus.weight * 0.1)} * exp(-length(p) / ${f(GALAXY.nucleus.scale)});

  // Young pop: flatter radial profile → arms carry the outer disk.
  float young = exp(-R / ${f(GALAXY.arms.youngScaleLength)}) * g_sech2(p.z / ${f(GALAXY.thinDisk.scaleHeight * 0.6)}) * radial;

  vec3 oldCol = vec3(1.0, 0.84, 0.66);
  vec3 bulgeCol = vec3(1.0, 0.72, 0.45);
  vec3 youngCol = vec3(0.5, 0.64, 1.0);
  vec3 hiiCol = vec3(1.0, 0.32, 0.55);

  vec3 em = oldCol * (thin * (0.7 + 0.5 * arm) + thick) * radial
    + youngCol * young * arm * ${f(GALAXY.arms.boost)} * (0.3 + 1.4 * clump)
    + hiiCol * young * arm * pow(clump, 5.0) * 5.0
    + bulgeCol * (bulge + core);

  float dustArm = g_arm(R, theta, ${f(GALAXY.dust.armShift)}, ${f(GALAXY.dust.width)});
  float dust = exp(-R / 3.2) * g_sech2(p.z / ${f(GALAXY.dust.scaleHeight)}) * radial
    * (0.25 + 1.6 * dustArm) * smoothstep(0.35, 0.75, g_fbm(p * 4.3 + 11.0));
  return vec4(em, dust);
}
`

// ─── Face-on map (HUD minimap) ───────────────────────────────────────────────
// Same components as GALAXY_GLSL, z-integrated → constants. Linear RGB, unbounded.
export function galaxyMapColor(x, y) {
  const R = Math.hypot(x, y)
  const theta = Math.atan2(y, x)
  const { innerTaper, outerCut, thinDisk, arms, bar, nucleus } = GALAXY
  const radial = smoothstep(innerTaper[0], innerTaper[1], R) * (1 - smoothstep(outerCut[0], outerCut[1], R))
  const arm = armField(R, theta)
  const old = Math.exp(-R / thinDisk.scaleLength) * (0.7 + 0.5 * arm) * radial
  const young = Math.exp(-R / arms.youngScaleLength) * arm * arms.boost * radial
  const bx = (x * Math.cos(BAR_ANGLE) + y * Math.sin(BAR_ANGLE)) / bar.axes[0]
  const by = (-x * Math.sin(BAR_ANGLE) + y * Math.cos(BAR_ANGLE)) / bar.axes[1]
  const bulge = bar.weight * 0.1 * Math.exp(-2 * Math.hypot(bx, by)) + nucleus.weight * 0.1 * Math.exp(-R / nucleus.scale)
  const dust = 1 - 0.55 * armField(R, theta, GALAXY.dust.armShift, GALAXY.dust.width) * radial
  return [
    (old * 1.0 + young * 0.5 + bulge * 1.0) * dust,
    (old * 0.84 + young * 0.64 + bulge * 0.72) * dust,
    (old * 0.66 + young * 1.0 + bulge * 0.45) * dust,
  ]
}
