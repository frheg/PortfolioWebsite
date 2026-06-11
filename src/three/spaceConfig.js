const isDev = import.meta.env.DEV

export const spaceConfig = {
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
    stars: isDev ? 3200 : 9000,
    galaxies: isDev ? 18 : 36,
    comets: isDev ? 8 : 12,
  },

  renderer: {
    fov: 75,
    near: 0.1,
    clearColor: 0x000000,
    maxPixelRatio: 2,
    powerPreference: 'high-performance',
    // ACES tonemapping maps physical candela values gracefully without clipping
    toneMappingExposure: 1.1,
  },

  camera: {
    initialZ: 150,
    transitionLerp: 0.025,
    scroll: {
      progressLerp: 0.08,
      rotLerp: 0.08,
      snapThreshold: 0.001,
      lockFrames: 8,
    },
    explore: {
      moveSpeed: 96,
      boostMultiplier: 2.45,
      acceleration: 3.0,
      coastDamping: 1.75,     // low = long space-like glide after releasing keys
      brakeAcceleration: 7.5,
      keyTurnSpeed: 1.8,
      keyPitchSpeed: 1.35,
      boostFovIncrease: 16,
      fovLerp: 0.12,
      boostShakeAmplitude: 0.18,
      boostShakeRotation: 0.01,
      boostShakeFrequency: 26,
      lookSensitivity: 0.0022,
      touchLookSensitivity: 0.003,
      worldMargin: 18,
      moveFieldRadiusFactor: 1.20,
      planetClearance: 8,
      maxPitch: 1.35,
      bankAngle: 0.1,
      bankLerp: 0.12,
    },
    orbit: {
      center: { x: 0, y: 0, z: 0 },
      rx: 168,
      ry: 28,
      rz: 152,
    },
    pageStops: [
      { path: '/', angle: 3.4, heightOffset: 8 },
      { path: '/projects', angle: 1.9, heightOffset: -10 },
      { path: '/journey', angle: 0.4, heightOffset: -4 },
      { path: '/contact', angle: -1.1, heightOffset: -12 },
    ],
  },

  skybox: {
    seamBlendPx: 32,
    // Quarter-turns per face: 1=90deg, 2=180deg, 3=270deg, 4=360deg/no-op.
    rotations: {
      rt: 1,
      lf: 2,
      up: 2,
      dn: 3,
      ft: 1,
      bk: 1,
    },
  },

  lights: {
    // Low ambient so sun-lit vs dark side is visible; point light does the heavy work
    ambient: { color: 0xffffff, intensity: 0.08 },
    point: {
      // Physical candelas at scene scale: 100k gives Earth ~0.5 lux → ACES maps it to ~60% brightness
      color: 0xfff4e0,
      intensity: 100000,
      distance: 0,   // 0 = infinite range (quadratic decay handles falloff naturally)
      decay: 2,
      position: { x: 0, y: 0, z: 0 },
    },
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
        { offset: 0, color: 'rgba(255, 255, 255, 1)' },
        { offset: 0.45, color: 'rgba(255, 255, 255, 0.95)' },
        { offset: 0.75, color: 'rgba(255, 255, 255, 0.35)' },
        { offset: 1, color: 'rgba(255, 255, 255, 0)' },
      ],
    },
  },

  solarSystem: {
    center: { x: 0, y: 0, z: 0 },
    // Slowed down ~3× from original so orbits feel stately
    timeScale: 0.055,
    textureAnisotropy: 4,
    segments: { width: 48, height: 48 },
    bodyCollisionPadding: 3,
    bodies: [
      // All radii and orbitRadii scaled ×0.625 so Pluto (orbit 800) fits
      // comfortably within the ~960-unit explore movement area.
      { key: 'sun',     radius: 19,  orbitRadius: 0,   orbitSpeed: 0,     rotationSpeed: 0.00075, axialTilt: 0.12, texture: 'sun',     emissive: true },
      { key: 'mercury', radius: 2.0, orbitRadius: 56,  orbitSpeed: 0.95,  rotationSpeed: 0.00150, axialTilt: 0.03, texture: 'mercury' },
      { key: 'venus',   radius: 3.5, orbitRadius: 92,  orbitSpeed: 0.74,  rotationSpeed: -0.0005, axialTilt: 3.09, texture: 'venus'   },
      { key: 'earth',   radius: 3.9, orbitRadius: 128, orbitSpeed: 0.62,  rotationSpeed: 0.00250, axialTilt: 0.41, texture: 'earth'   },
      // tidallyLocked: moon rotation tracks its orbital angle so the near side always faces Earth
      { key: 'moon',    radius: 1.2, orbitRadius: 13,  orbitSpeed: 2.60,  rotationSpeed: 0.00075, axialTilt: 0.09, texture: 'moon',   parent: 'earth', tidallyLocked: true },
      { key: 'mars',    radius: 2.9, orbitRadius: 181, orbitSpeed: 0.50,  rotationSpeed: 0.00250, axialTilt: 0.44, texture: 'mars'    },
      { key: 'jupiter', radius: 9.1, orbitRadius: 300, orbitSpeed: 0.28,  rotationSpeed: 0.00550, axialTilt: 0.05, texture: 'jupiter' },
      { key: 'saturn',  radius: 7.8, orbitRadius: 412, orbitSpeed: 0.20,  rotationSpeed: 0.00475, axialTilt: 0.47, texture: 'saturn',  ringTexture: 'saturnRing', ringInner: 9.4,  ringOuter: 21,   ringOpacity: 0.72 },
      { key: 'uranus',  radius: 5.8, orbitRadius: 512, orbitSpeed: 0.15,  rotationSpeed: 0.00375, axialTilt: 1.71, texture: 'uranus',  ringTexture: 'uranusRing', ringInner: 7.8,  ringOuter: 10.6, ringOpacity: 0.48 },
      { key: 'neptune', radius: 5.6, orbitRadius: 612, orbitSpeed: 0.11,  rotationSpeed: 0.00325, axialTilt: 0.49, texture: 'neptune' },
      { key: 'pluto',   radius: 1.4, orbitRadius: 800, orbitSpeed: 0.073, rotationSpeed: 0.00039, axialTilt: 2.13, texture: 'pluto'   },
    ],
    ufo: {
      count: 3,
      scale: 0.45,
      roamRadius: 875,
      minSunDistance: 44,
      speed: 20,
      steering: 0.22,
      wobble: 0.18,
      collisionRadius: 4,
    },
  },

  galaxies: {
    spawnRadiusFactor: 1.25,
    colorThemes: [
      { h: 0.05, s: 0.8, l: 0.6 },
      { h: 0.6, s: 0.9, l: 0.7 },
      { h: 0.15, s: 0.7, l: 0.8 },
    ],
    drift: { min: -0.02, max: 0.02 },
    rotationSpeed: { min: 0.001, max: 0.002 },
    star: {
      count: 100,
      galaxySize: 20,
      radiusFactor: 0.4,
      heightFactor: 0.2,
      size: 0.3,
      segments: 8,
      opacity: 0.6,
      hueVariation: 0.1,
    },
  },

  comets: {
    fieldRadiusFactor: 0.85,
    speed: { min: 0.5, max: 2.0 },
    core: { radius: 0.3, segments: 16, color: 0xffffff },
    glow: { radius: 0.9, segments: 16, color: 0x66ccff, opacity: 0.3 },
    halo: { innerRadius: 0.6, outerRadius: 1.1, segments: 32, color: 0x66ccff, opacity: 0.15 },
    trail: {
      baseColor: 0x66ccff,
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
