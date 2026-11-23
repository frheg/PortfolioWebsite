// Nearest star (catalog or procedural) → explore speed limit + HUD. Written by useGalaxy at a few Hz.
// world: km, scene frame. valid false → none within search radius. name null → procedural/unnamed.
export const nearestStar = {
  valid: false,
  world: { x: 0, y: 0, z: 0 },
  radiusKm: 0,
  temp: 0,
  absMag: 0,
  name: null,
}
