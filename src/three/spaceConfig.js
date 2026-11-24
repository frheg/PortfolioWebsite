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
    clearColor: 0x000000, // space
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
      minAltitude: 0.02,    // km above terrain (~20 m)
      // Low level: jet-like. Speed floor (≈ Mach 0.75) + boost capped (≈ Mach 2), blends out by jetBlendAltKm.
      jetCruise: 0.25,      // km/s
      jetBoostMultiplier: 2.4,
      jetBlendAltKm: [2, 100],
      maxGalaxyDistance: 1_200_000 * PC_KM, // from galactic center (Andromeda reachable)
      wormholeFovKick: 55,  // deg, eases back after Sgr A* exit
      localUpRange: [0.15, 0.8], // altitude / radius: below near → full local vertical, above far → world up
      carryRadii: 30,       // altitude / radius: inside → camera rides with body's orbit
      spinCarryRange: [0.05, 0.4], // altitude / radius: below near → fully rides body spin
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
    // axialTiltX (Earth): real obliquity → pole = true NCP; with realSpin: rotation = GMST (day/night real).
    // textureLonOffset: deg, where the texture puts real lon 0 vs our 0°-centered convention
    // (Mars map is 0–360 → 180; Venus map shifted → −60). Verified by feature overlay. Places only.
    // atmosphere: post-pass scattering (atmosphere.js). km + 1/km. Earth = standard Rayleigh/Mie.
    // sunIntensity ≈ lights.sun.intensity → sky + haze stay in balance with lit ground.
    bodies: [
      { key: 'sun',     radius: 695_700, rotationSign: 1,  axialTilt: 0.12, texture: 'sun',     emissive: true, beaconPx: 0, beaconColor: 0xf9e2af },
      { key: 'mercury', radius: 2_439.7, rotationSign: 1,  axialTilt: 0.03, texture: 'mercury', beaconPx: 3,   beaconColor: 0x9399b2 },
      { key: 'venus',   radius: 6_051.8, textureLonOffset: -60, rotationSign: -1, axialTilt: 3.09, texture: 'venus',   beaconPx: 3.5, beaconColor: 0xfab387, atmosphere: { height: 120, betaR: [12e-3, 9e-3, 4e-3], betaM: 8e-3, Hr: 15.9, Hm: 6, g: 0.7, sunIntensity: 6 } },
      { key: 'earth',   radius: 6_371,   rotationSign: 1,  axialTilt: 0, axialTiltX: 0.40910518, realSpin: true, nightTexture: 'earthLights', nightGain: 1.6, texture: 'earth',   beaconPx: 3.5, beaconColor: 0x94e2d5, atmosphere: { height: 100, betaR: [5.802e-3, 13.558e-3, 33.1e-3], betaM: 3.996e-3, Hr: 8, Hm: 1.2, g: 0.8, sunIntensity: 7 } },
      // Moon: circular orbit, real period, tidally locked.
      { key: 'moon',    radius: 1_737.4, rotationSign: 1,  axialTilt: 0.09, texture: 'moon',    parent: 'earth', orbitRadius: 384_400, orbitInclination: 0.0898, tidallyLocked: true, beaconPx: 2.5, beaconColor: 0xa6adc8, labelRange: 5e6 },
      { key: 'mars',    radius: 3_389.5, textureLonOffset: 180, rotationSign: 1,  axialTilt: 0.44, texture: 'mars',    beaconPx: 3,   beaconColor: 0xeba0ac, atmosphere: { height: 90, betaR: [2e-3, 1.36e-3, 0.58e-3], betaM: 4e-3, Hr: 11.1, Hm: 3, g: 0.7, sunIntensity: 5 } },
      { key: 'jupiter', radius: 69_911,  rotationSign: 1,  axialTilt: 0.05, texture: 'jupiter', beaconPx: 4,   beaconColor: 0xf9e2af, atmosphere: { height: 800, betaR: [1.2e-4, 1.6e-4, 2.4e-4], betaM: 1.5e-4, Hr: 27, Hm: 20, g: 0.7, sunIntensity: 5 } },
      // Rings: C ring inner → A ring outer. ringUv 'radial' = 1D strip texture (u = radius); else planar top-down image.
      { key: 'saturn',  radius: 58_232,  rotationSign: 1,  axialTilt: 0.47, texture: 'saturn',  ringTexture: 'saturnRing', ringUv: 'radial', ringInner: 74_500, ringOuter: 136_800, ringOpacity: 0.72, beaconPx: 4, beaconColor: 0xf5e0dc, atmosphere: { height: 900, betaR: [1.4e-4, 1.4e-4, 1.6e-4], betaM: 1.2e-4, Hr: 60, Hm: 30, g: 0.7, sunIntensity: 5 } },
      { key: 'uranus',  radius: 25_362,  rotationSign: -1, axialTilt: 1.71, texture: 'uranus',  ringTexture: 'uranusRing', ringInner: 34_100, ringOuter: 46_400, ringOpacity: 0.48, beaconPx: 3.5, beaconColor: 0x89dceb, atmosphere: { height: 600, betaR: [0.6e-4, 1.4e-4, 1.8e-4], betaM: 0.4e-4, Hr: 28, Hm: 20, g: 0.7, sunIntensity: 5 } },
      { key: 'neptune', radius: 24_622,  rotationSign: 1,  axialTilt: 0.49, texture: 'neptune', beaconPx: 3.5, beaconColor: 0x74c7ec, atmosphere: { height: 600, betaR: [0.5e-4, 1.0e-4, 2.2e-4], betaM: 0.4e-4, Hr: 20, Hm: 15, g: 0.7, sunIntensity: 5 } },
      { key: 'pluto',   radius: 1_188.3, rotationSign: -1, axialTilt: 2.13, texture: 'pluto',   beaconPx: 2.5, beaconColor: 0xf2cdcd },
    ],
    // Real Earth surface tiles (explore only). URL templates: {z} {x} {y}.
    earthTerrain: {
      // EOX Sentinel-2 cloudless 2020, CC BY-NC-SA 4.0 (non-commercial). Alt (public domain, z≤8):
      // https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg
      imageryUrl: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
      // Close-up (z > imageryMaxZoom): Esri World Imagery, sub-meter. Attribution in HUD.
      closeImageryUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      imageryMaxZoom: 9,    // Esri from z10 → source seam stays far from camera
      // AWS Terrain Tiles (Terrarium), open data.
      terrainUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      terrainMaxZoom: 15,
      maxZoom: 18,
      maxZoomMobile: 17,
      grid: 32,             // quads per tile edge
      splitPx: 1.25,        // refine when imagery texel > this many px (× quality.terrainSplitScale)
      splitPxMobile: 2.4,
      maxTiles: 320,        // GPU cache cap (≈0.4 MB/tile)
      maxTilesMobile: 160,
      tilesPerGb: 40,       // budget = device RAM (GB) × this, clamped
      minTiles: 100,
      idleEvictMs: 8000,    // unseen this long → freed even under budget
      highPriorityLoads: 4, // nearest N fetches get high network priority
      uploadsPerFrame: 4,   // tiles made drawable per frame (smooth)
      cancelAfterFrames: 30, // unwanted in-flight load → aborted
      maxInFlight: 12,
      maxInFlightMobile: 6,
      lookaheadLevels: 2,   // prefetch under cam beyond next level
      distanceFalloffKm: 40, // split threshold × (1 + dist / this)
      maxReliefKm: 3,       // horizon allowance for distant peaks
      workers: 3,
      workersMobile: 2,
      activeRadii: 12,      // render distance: × Earth radius from center
      baseSinkKm: 3,        // base sphere sinks under tiles (no z-fight)
    },
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

  postFx: {
    bloomLevels: 5,
    bloomThreshold: 3,      // HDR linear, max channel. Only sun/very bright cores bloom.
    bloomStrength: 0.4,
    maxAtmospheres: 2,
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
      // × densityScale: calibrated so procedural sky ≈ catalog sky near the Sun.
      densityScale: 0.35,
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
      promoteDistancePc: 0.05, // nearest star → real sphere + label inside this (~10 000 AU)
    },
    neighbors: {
      sprites: 30000,       // × per-galaxy weight
      mobileFactor: 0.5,
      gain: 0.7,            // ÷ sprite overlap (M31 = faint smudge from home)
    },
    deepSpace: {
      nebulaSprites: 7000,
      mobileFactor: 0.5,
      nebulaGain: 1.4,      // ÷ sprite overlap → total brightness independent of count
      nebulaMaxPx: 180,     // overdraw cap
      diskOuterRs: 24,
      diskGain: 2.2,
      diskSpin: 0.6,        // visual time scale for disk rotation
      lensMinPx: 2,         // Einstein radius on screen to switch lens pass on
      photonRingGain: 0.9,
    },
  },
}

export default spaceConfig
