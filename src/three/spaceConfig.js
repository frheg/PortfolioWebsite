// Central configuration for the 3D space and entity counts
// Tweak values here to affect the entire scene

export const spaceConfig = {
  // Axis-aligned world bounds (world units)
  bounds: {
    width: 2000,
    height: 1600,
    depth: 2000,
  },

  // Derived half extents for convenience
  get half() {
    const { width, height, depth } = this.bounds
    return { x: width / 2, y: height / 2, z: depth / 2 }
  },

  // Global entity totals
  counts: {
    stars: 9000,
    galaxies: 36,
    comets: 12,
  },

  // Animation/speed defaults
  rotationSpeed: 0.005, // starfield rotation baseline
  cometSpeed: { min: 0.5, max: 2.0 },
}

export default spaceConfig
