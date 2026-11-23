const isDev = import.meta.env.DEV

// Units: world = km, float64 (JS numbers). Sun at world 0.
// Render: floating origin → camera always at render 0 (see floatingOrigin.js).
// Sky layer (skybox, starfield, deco galaxies, comets) = own scene,
// rotation-only cam, own arbitrary units (bounds below).
export const AU_KM = 149_597_870.7

export const spaceConfig = {
  // Sky layer extent, sky units.
  bounds: {
    width: 5000,
    height: 3200,
    depth: 5000,
  },

  get half() {
    const { width, height, depth } = this.bounds
    return { x: width / 2, y: height / 2, z: depth / 2 }
  },

  counts: {
    stars: isDev ? 1800 : 8000,
    galaxies: isDev ? 18 : 36,
    comets: isDev ? 8 : 12,
  },

  renderer: {
    fov: 75,
    // World cam, km. Log depth → 1 m to ~670 AU in one pass.
    near: 1e-3,
    far: 1e11,
    // Sky cam, sky units.
    skyNear: 0.1,
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
      maxSpeed: 3e9,        // km/s (~10 000c)
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
      maxSunDistance: 200 * AU_KM,
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

  nebula: {
    seed: 1337,
    // Noise grid computed at this size, then upscaled onto textureSize —
    // nebulae are inherently soft, so the upscale reads as detail rather
    // than blur, and it keeps generation fast even at a large final size.
    gridSize: isDev ? 96 : 224,
    textureSize: isDev ? 768 : 3072,
    // Star radii below were tuned at this texture size; useSkybox scales
    // them by (actual size / this) so stars keep their apparent size —
    // and just get smoother edges — as textureSize changes.
    referenceTextureSize: 2048,
    mobileTextureSize: 2048,
    cloudScale: 1.6,
    detailScale: 4.5,
    octaves: 4,
    detailOctaves: 3,
    densityPower: 2.4,
    densityFloor: 0.05,
    // Catppuccin Mocha: crust background, sky/sapphire through mauve for
    // the cloud color (lavender through mauve — the same hues used across
    // the UI and the rest of the scene).
    baseColor: { r: 17, g: 17, b: 27 },
    colorStops: [
      { h: 0.61, s: 0.6, l: 0.4 },
      { h: 0.6441, s: 0.5, l: 0.38 },
      { h: 0.7428, s: 0.62, l: 0.46 },
    ],
    starCount: isDev ? 500 : 2200,
    starMinRadius: 0.15,
    starMaxRadius: 0.55,
    starGlowMultiplier: 2.4,
  },

  lights: {
    ambient: { color: 0xcdd6f4, intensity: 0.08 }, // text
    // Sun light = child of sun anchor. decay 0 → no falloff, outer planets stay readable.
    // Intensity ≈ old Earth illuminance (1e5 cd / 128²).
    sun: { color: 0xf5e0dc, intensity: 6, decay: 0 }, // rosewater
  },

  starfield: {
    fieldRadiusFactor: 1.7,
    rotationSpeed: 0.005,
    pointSize: 1.25,
    opacity: 0.9,
    alphaTest: 0.08,
    boost: {
      lerp: 0.14,
      sizeMultiplier: 2.6,
      spreadMultiplier: 1.08,
      opacityBoost: 0.08,
      textureThreshold: 0.18,
    },
    hRange: { min: 0, max: 1 },
    sRange: { min: 0.6, max: 1 },
    lRange: { min: 0.6, max: 0.9 },
    twinkle: {
      timeStep: 0.1,
      orbitPhaseStep: 0.05,
      colorPhaseStep: 0.1,
      amplitude: 1.2,
      base: 0.3,
    },
    sprite: {
      size: 64,
      gradientStops: [
        { offset: 0, color: 'rgba(205, 214, 244, 1)' },
        { offset: 0.45, color: 'rgba(205, 214, 244, 0.95)' },
        { offset: 0.75, color: 'rgba(205, 214, 244, 0.35)' },
        { offset: 1, color: 'rgba(205, 214, 244, 0)' },
      ],
    },
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
    },
    // Real radii, km. Positions: ephemeris (sun fixed at 0, moon custom).
    // beaconPx: min-size dot when sub-pixel. labelRange: km, hide label past it.
    bodies: [
      { key: 'sun',     radius: 695_700, rotationSign: 1,  axialTilt: 0.12, texture: 'sun',     emissive: true, beaconPx: 8, beaconColor: 0xf9e2af },
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

  galaxies: {
    spawnRadiusFactor: 1.25,
    colorThemes: [
      { h: 0.0638, s: 0.8, l: 0.6 }, // peach
      { h: 0.6441, s: 0.9, l: 0.7 }, // lavender
      { h: 0.1149, s: 0.7, l: 0.8 }, // yellow
    ],
    drift: { min: -0.02, max: 0.02 },
    rotationSpeed: { min: 0.001, max: 0.002 },
    star: {
      count: 100,
      galaxySize: 20,
      radiusFactor: 0.4,
      heightFactor: 0.2,
      size: 0.3,
      opacity: 0.6,
      hueVariation: 0.1,
    },
  },

  comets: {
    fieldRadiusFactor: 0.85,
    speed: { min: 0.5, max: 2.0 },
    core: { radius: 0.3, segments: 16, color: 0xcdd6f4 }, // text
    glow: { radius: 0.9, segments: 16, color: 0x94a2f9, opacity: 0.3 }, // sapphire
    halo: { innerRadius: 0.6, outerRadius: 1.1, segments: 32, color: 0x94a2f9, opacity: 0.15 },
    trail: {
      baseColor: 0x94a2f9,
      segments: 64,
      meshes: [
        { length: 20, radius: 0.8, opacity: 0.4 },
        { length: 22, radius: 1.2, opacity: 0.2 },
        { length: 24, radius: 1.6, opacity: 0.08 },
      ],
    },
    inwardTargetFactor: 0.2,
    velocityOffset: { min: -0.3, max: 0.3 },
  },
}

export default spaceConfig
