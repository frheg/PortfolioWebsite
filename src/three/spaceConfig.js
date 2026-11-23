// Units: world = km, float64 (JS numbers). Sun at world 0.
// Render: floating origin → camera always at render 0 (see floatingOrigin.js).
// Galaxy glow = sky pass (galaxyVolume.js). Stars = world pass, RTE points (starMaterial.js).
// Frames + unit constants: galaxyFrame.js.
import { AU_KM, PC_KM } from './galaxyFrame'

export { AU_KM }

export const spaceConfig = {
  renderer: {
    fov: 75,
    // km. Log depth → 1 m to ~3 Mpc in one pass.
    near: 1e-3,
    far: 1e20,
    clearColor: 0x11111b, // crust
    maxPixelRatio: 2,
    powerPreference: 'high-performance',
    toneMappingExposure: 1.1,
  },

  camera: {
    transitionLerp: 0.025,
    scroll: {
      rotLerp: 0.08,
      lockFrames: 8,
      // Segment progress remap: hold at stop until holdStart, arrive by holdEnd.
      holdStart: 0.3,
      holdEnd: 0.95,
      // Travel arc lift above ecliptic, × segment length. Avoids flying thru sun.
      arcLift: 0.3,
      // Scroll speed (fraction of page height / s) → full warp visual.
      velocityBoostThreshold: 2.2,
      velocityLerp: 0.08,
    },
    explore: {
      baseFov: 40,
      // Speed = altitude × speedPerAltitude (km/s per km). Log-feel travel:
      // 1 AU → 1000 km alt ≈ ln(1.5e5) / k seconds.
      speedPerAltitude: 0.5,
      minSpeed: 0.02,       // km/s
      maxSpeed: 1e17,       // km/s (~3 kpc/s)
      boostMultiplier: 8,
      boostBlendRate: 3,    // 1/s, speed cap eases 1× ↔ boost
      acceleration: 2.2,    // 1/s, exp approach to target vel
      brakeAcceleration: 6, // 1/s, reversing
      coastDamping: 0.55,   // 1/s, no input. low = long glide
      keyTurnSpeed: 0.55,
      keyPitchSpeed: 0.45,
      boostFovIncrease: 16,
      fovLerp: 0.12,
      boostShakeRotation: 0.01,
      boostShakeFrequency: 26,
      lookSensitivity: 0.0022,
      touchLookSensitivity: 0.003,
      minAltitude: 1,       // km above surface
      maxGalaxyDistance: 150_000 * PC_KM, // from galactic center
      // Nearest star limits speed: effective altitude = d × factor, factor 1 → starInfluence
      // over starInfluenceRangePc. Far stars barely brake, close ones fully.
      starInfluence: 50,
      starInfluenceRangePc: [0.01, 1],
      maxPitch: 1.35,
      bankAngle: 0.1,
      bankLerp: 0.12,
    },
    // Order must match chapterOrder (src/content/chapters.js).
    // body: target key. distance: × body radius, from center.
    // azimuth: rad from body→sun dir (0 = full lit, π = backlit).
    // elevation: rad above ecliptic. lookShiftX/Y: aim offset, × radius
    // (+X aim right → body sits left).
    pageStops: [
      { path: '/',         body: 'earth',   distance: 3.4, azimuth: 0.75, elevation: 0.2,  lookShiftX: 0.5,  lookShiftY: 0 },
      { path: '/projects', body: 'mars',    distance: 3.2, azimuth: -0.8, elevation: 0.15, lookShiftX: -0.5, lookShiftY: 0 },
      { path: '/journey',  body: 'jupiter', distance: 3.6, azimuth: 0.9,  elevation: 0.1,  lookShiftX: 0.55, lookShiftY: 0 },
      { path: '/contact',  body: 'saturn',  distance: 6.5, azimuth: -0.7, elevation: 0.38, lookShiftX: -0.9, lookShiftY: 0 },
      { path: '/chat',     body: 'neptune', distance: 3.4, azimuth: 1.1,  elevation: 0.12, lookShiftX: 0.5,  lookShiftY: 0 },
    ],
  },

  lights: {
    ambient: { color: 0xcdd6f4, intensity: 0.08 }, // text
    // Sun light = child of sun anchor. decay 0 → no falloff, outer planets stay readable.
    // Intensity ≈ old Earth illuminance (1e5 cd / 128²).
    sun: { color: 0xf5e0dc, intensity: 6, decay: 0 }, // rosewater
  },

  solarSystem: {
    // Scroll mode: positions at real time (1×), spin sped up ×this. Explore: ephemerisTime.
    scrollSpinScale: 600,
    textureAnisotropy: 8,
    // LOD by projected radius px (see bodyLod.js).
    lod: {
      dotFade: [0.8, 2.5],  // dot → impostor crossfade
      meshIn: 24,           // impostor → mesh
      meshOut: 20,          // mesh → impostor (hysteresis)
      // Mesh detail by px. Chord sag stays ≤ ~0.2 px at each switch.
      meshLevels: [
        { maxPx: 100, segments: [48, 24] },
        { maxPx: 400, segments: [96, 48] },
        { maxPx: Infinity, segments: [192, 96] },
      ],
      levelHysteresis: 0.15,
      dotNightFloor: 0.35,  // dot brightness when fully backlit
      dotFadeFar: [300 * AU_KM, 800 * AU_KM], // planets invisible from interstellar space
      planetLabelRange: 2000 * AU_KM,
    },
    // Real radii, km. Positions: ephemeris (sun fixed at 0, moon custom).
    // beaconPx: min-size dot when sub-pixel. labelRange: km, hide label past it.
    bodies: [
      { key: 'sun',     radius: 695_700, rotationSign: 1,  axialTilt: 0.12, texture: 'sun',     emissive: true, beaconPx: 0, beaconColor: 0xf9e2af },
      { key: 'mercury', radius: 2_439.7, rotationSign: 1,  axialTilt: 0.03, texture: 'mercury', beaconPx: 3,   beaconColor: 0x9399b2 },
      { key: 'venus',   radius: 6_051.8, rotationSign: -1, axialTilt: 3.09, texture: 'venus',   beaconPx: 3.5, beaconColor: 0xfab387 },
      { key: 'earth',   radius: 6_371,   rotationSign: 1,  axialTilt: 0.41, texture: 'earth',   beaconPx: 3.5, beaconColor: 0x94e2d5 },
      // Moon: circular orbit, real period, tidally locked.
      { key: 'moon',    radius: 1_737.4, rotationSign: 1,  axialTilt: 0.09, texture: 'moon',    parent: 'earth', orbitRadius: 384_400, orbitInclination: 0.0898, tidallyLocked: true, beaconPx: 2.5, beaconColor: 0xa6adc8, labelRange: 5e6 },
      { key: 'mars',    radius: 3_389.5, rotationSign: 1,  axialTilt: 0.44, texture: 'mars',    beaconPx: 3,   beaconColor: 0xeba0ac },
      { key: 'jupiter', radius: 69_911,  rotationSign: 1,  axialTilt: 0.05, texture: 'jupiter', beaconPx: 4,   beaconColor: 0xf9e2af },
      // Rings: C ring inner → A ring outer. ringUv 'radial' = 1D strip texture (u = radius); else planar top-down image.
      { key: 'saturn',  radius: 58_232,  rotationSign: 1,  axialTilt: 0.47, texture: 'saturn',  ringTexture: 'saturnRing', ringUv: 'radial', ringInner: 74_500, ringOuter: 136_800, ringOpacity: 0.72, beaconPx: 4, beaconColor: 0xf5e0dc },
      { key: 'uranus',  radius: 25_362,  rotationSign: -1, axialTilt: 1.71, texture: 'uranus',  ringTexture: 'uranusRing', ringInner: 34_100, ringOuter: 46_400, ringOpacity: 0.48, beaconPx: 3.5, beaconColor: 0x89dceb },
      { key: 'neptune', radius: 24_622,  rotationSign: 1,  axialTilt: 0.49, texture: 'neptune', beaconPx: 3.5, beaconColor: 0x74c7ec },
      { key: 'pluto',   radius: 1_188.3, rotationSign: -1, axialTilt: 2.13, texture: 'pluto',   beaconPx: 2.5, beaconColor: 0xf2cdcd },
    ],
    // UFOs roam LEO-ish shell round Earth.
    ufo: {
      count: 3,
      scale: 0.006,          // saucer ~40 m wide
      shellInner: 400,       // km altitude
      shellOuter: 4_000,
      speed: 7.8,            // km/s
      steering: 0.22,
      wobble: 0.18,
      collisionRadius: 0.05, // km
      labelRange: 2e4,
    },
  },

  galaxy: {
    volume: {
      exposure: 0.9,
      knee: 1.6,           // soft compression strength
      adaptation: 3,       // exposure / (1 + this·√(local star density, sun = 1))
      dustOpacity: 8,
      maxSteps: 140,       // cube capture
      liveSteps: 72,
      liveStepsMobile: 48,
      cubeSize: 512,
      cubeSizeMobile: 256,
      liveScale: 0.4,      // × drawing buffer
      liveScaleMobile: 0.25,
      // Recapture when cam drifts > tolPc + tolFrac × dist to GC (pc).
      captureTolPc: 2,
      captureTolFrac: 0.0005,
      liveSpeedFactor: 2,  // drifting faster than tol × this /s → live march
      mixRate: 5,          // 1/s crossfade
    },
    stars: {
      magLimit: 7.5,
      magLimitMobile: 7,
      gain: 1,
      seed: 1337,
      // Procedural bands: abs mag range + local density (stars/pc³ at sun, rough local LF).
      bands: [
        { mag: [-10, -7.5], density: 2e-9 },
        { mag: [-7.5, -5], density: 3e-8 },
        { mag: [-5, -2.5], density: 5e-7 },
        { mag: [-2.5, 0], density: 1.5e-5 },
        { mag: [0, 2.5], density: 3e-4 },
        { mag: [2.5, 5], density: 3e-3 },
        { mag: [5, 7.5], density: 8e-3 },
        { mag: [7.5, 10], density: 1.5e-2 },
        { mag: [10, 12.5], density: 3e-2 },
        { mag: [12.5, 16], density: 6e-2 },
      ],
      loadMagMargin: 1,     // load band out to where its brightest star is this far below limit
      cellFactor: 0.75,     // cell size × load radius
      cellCap: 30000,
      cellFadeS: 0.6,
      maxInFlight: 6,
      scanIntervalS: 0.25,
      catalogCompleteMag: 8.5, // HYG ~complete to here
      catalogMaxPc: 1000,
      nearestSearchPc: 5,
      nearestIntervalS: 0.2,
      labelMag: 1.5,        // named star label when brighter than this
      labelNearPc: 4,       // ...or closer than this
    },
  },
}

export default spaceConfig
