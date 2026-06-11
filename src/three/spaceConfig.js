const isDev = import.meta.env.DEV

export const spaceConfig = {
  bounds: {
    width: 2000,
    height: 1600,
    depth: 2000,
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
    orbit: {
      center: { x: -50, y: 10, z: -50 },
      rx: 55,
      ry: 25,
      rz: 50,
    },
    pageStops: [
      { path: '/', angle: 3.4, heightOffset: 0 },
      { path: '/projects', angle: 1.9, heightOffset: -8 },
      { path: '/journey', angle: 0.4, heightOffset: -5 },
      { path: '/contact', angle: -1.1, heightOffset: -9 },
    ],
  },

  skybox: {
    seamBlendPx: 32,
    // Quarter-turns per face: 1=90deg, 2=180deg, 3=270deg, 4=360deg/no-op.
    rotations: {
      rt: 1,
      lf: 2,
      up: 4,
      dn: 4,
      ft: 1,
      bk: 1,
    },
  },

  lights: {
    ambient: { color: 0xffffff, intensity: 0.5 },
    point: {
      color: 0xffffff,
      intensity: 1,
      distance: 500,
      position: { x: 50, y: 50, z: 50 },
    },
  },

  starfield: {
    fieldRadiusFactor: 1,
    rotationSpeed: 0.005,
    pointSize: 1.25,
    opacity: 0.9,
    alphaTest: 0.08,
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

  planet: {
    radius: 10,
    segments: { width: 32, height: 32 },
    position: { x: -50, y: 10, z: -50 },
    scale: 1,
    rotationSpeed: 0.001,
    texture: {
      anisotropy: 4,
    },
  },

  galaxies: {
    spawnRadiusFactor: 0.9,
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
    fieldRadiusFactor: 0.5,
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
