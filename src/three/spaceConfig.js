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
    far: 1e23,           // ~3 Gpc: Virgo (16.5 Mpc) + field galaxies (≤ 45 Mpc) inside
    clearColor: 0x000000, // space
    maxPixelRatio: 2,
    powerPreference: 'high-performance',
    toneMappingExposure: 1.1,
    // frameGovernor: upload spreading + dynamic resolution (× quality pixel ratio).
    dynamicRes: {
      enabled: true,
      steps: [1, 0.85, 0.72, 0.6],
      downMs: 26,         // frame EMA above → slow
      upMs: 18,           // below → fast
      downHoldS: 0.5,     // slow this long → step down
      upHoldS: 4,         // fast this long → step up (doubles on oscillation)
      maxUpHoldS: 60,
      uploadsPerFrame: 2, // queued drawables made live per frame
    },
    // Scroll pages at rest → capped fps. Any scroll / camera turn → full rate.
    idle: { fps: 30, afterS: 1.5, maxTurnRadS: 0.003 },
  },

  camera: {
    transitionLerp: 0.012, // explore ↔ page flight, per frame (~1.4 s)
    scroll: {
      rotLerp: 0.08,
      lockFrames: 8,
      // Fallback (no travel ranges yet): hold at stop until holdStart, arrive by holdEnd.
      holdStart: 0.3,
      holdEnd: 0.95,
      // Empty scroll between chapters (LongPage spacers) = the journey, per gap (vh). Longer where more scales are crossed:
      // Milky Way→Sgr A* ~10 decades, Sgr A*→Lagoon ~6, Lagoon→Earth ~12, Earth→Bergen ~4 (2 sub-legs: descent via).
      travelVh: [760, 600, 560, 420],
      // While reading a page: scroll orbits the camera round the stop's subject (± deg, about stop up) → never static.
      orbitDeg: 12,
      // Camera follows a smoothed scroll position (1/s) → wheel steps glide instead of jump.
      scrollSmoothing: 6,
      mistMax: 0.55,        // speed-mist strength at fast scale changes (masks LOD pops / tile loads)
      // Path bulge, × segment length, along the stops' up vectors → no flying through bodies.
      arcLift: 0.12,
      // Look: keep facing what we leave until lookTurn[0] of the leg, face destination by lookTurn[1].
      lookTurn: [0.25, 0.85],
      rotRate: 3.5,         // 1/s, camera orientation ease toward path orientation (lag → turns easy to follow)
      // Intro (starts as the loading screen fades): from far outside the Local Group (Virgo behind it) → past Andromeda
      // (M33 in frame) → route's stop. Log-scale legs, names shown on the way.
      introStartMpc: 3,     // from Local Group centre, opposite Virgo
      introStartLift: 0.25, // × start distance, toward galactic north (look slightly down on the group)
      introM31Kpc: 140,     // Andromeda glimpse: distance from its centre
      introM31Az: 55,       // deg off the M31→Milky Way line (side view, disk + M33 in frame)
      introSplit: 0.45,     // fraction of the glide spent reaching Andromeda
      introGlideS: 10,
      introLookTurn: [0.1, 0.6],
      // Earth spin offset in scroll mode → Bergen time follows the Bergen-stop scroll: real sunset → night → real sunrise
      // (sun 2° above horizon, today's declination). Polar day/night → fallback hours. Earlier stops keep sunset.
      homeTime: { lat: 60.39, lon: 5.32, sunAltDeg: 2, fallbackSet: 15, fallbackRise: 9 },
      // Scroll speed (fraction of page height / s) → full warp visual.
      velocityBoostThreshold: 2.2,
      velocityLerp: 0.08,
    },
    // Guided tour ("Omvisning", navbar): hands-off flight through highlights, caption per stop, then back to the page.
    // Each stop: pose (same types as pageStops + sky/localGroup/comet) → leg (legS) in, hold (holdS) with slow orbit.
    //   sky:        ra/dec (deg), distPc, viewPc (camera distance), azimuth/elevation (deg, like nebula)
    //   localGroup: viewMpc, azimuth/elevation (deg)
    //   comet:      key, viewKm, azimuth/elevation (deg)
    // Order: outside in (clusters → galaxies → Milky Way → solar system outer → inner), ends at Earth.
    tour: {
      legS: 3,
      holdS: 6.5,           // reading time per caption
      returnS: 3.5,
      stops: [
        { pose: { type: 'sky', ra: 187.706, dec: 12.391, distPc: 16_500_000, viewPc: 4_500_000, azimuth: 35, elevation: 20 },
          title: 'Virgohopen', facts: ['1 300–2 000 galakser, 54 millioner lysår unna', 'Kjempen M87 i midten har et sort hull på 6,5 milliarder solmasser', 'Tyngdekraften herfra trekker også på oss'] },
        { pose: { type: 'localGroup', viewMpc: 2.2, azimuth: 150, elevation: 25 },
          title: 'Den lokale gruppen', facts: ['Vårt galaktiske nabolag: ~80 galakser', '~10 millioner lysår på tvers', 'Melkeveien og Andromeda er de to største'] },
        { pose: { type: 'galaxy', key: 'm31', distanceKpc: 85, inclination: 45, azimuth: 30 },
          title: 'Andromedagalaksen', facts: ['~1 billion stjerner, 2,5 millioner lysår unna', 'Lyset du ser nå dro før mennesket fantes', 'Kolliderer med Melkeveien om ~4,5 milliarder år'] },
        { pose: { type: 'galaxy', key: 'lmc', distanceKpc: 16, inclination: 30, azimuth: 200 },
          title: 'Den store magellanske sky', facts: ['Satellittgalakse i bane rundt Melkeveien', 'Taranteltåken her er den største stjernefabrikken i nabolaget', 'Supernova 1987A eksploderte her'] },
        { pose: { type: 'galactic', pos: [24, -12, 16], look: [0, 0, 0] },
          title: 'Melkeveien', facts: ['100–400 milliarder stjerner', 'Solen bruker ~230 millioner år på én runde', 'Vi bor i en sidearm, ~26 000 lysår fra sentrum'] },
        { pose: { type: 'blackhole', key: 'sgra', distanceRs: 26, inclination: 75, azimuth: 120 },
          title: 'Sagittarius A*', facts: ['Sort hull på 4,3 millioner solmasser', 'Lyset bøyes rundt det: du ser baksiden av skiven', 'Avbildet av Event Horizon Telescope i 2022'] },
        { pose: { type: 'nebula', key: 'orion', distanceRadii: 3, azimuth: 20, elevation: 10 },
          title: 'Oriontåken', facts: ['Nærmeste store stjernefødested, 1 344 lysår unna', 'Tusenvis av nyfødte stjerner', 'Synlig med blotte øye i Orions sverd'] },
        { pose: { type: 'body', body: 'pluto', distance: 3.5, azimuth: 0.5, elevation: 0.2, lookShiftX: 0, lookShiftY: 0 },
          title: 'Pluto', facts: ['Dvergplanet siden 2006', 'Ett år på Pluto = 248 jordår', 'Har en hjerteformet isslette: Tombaugh Regio'] },
        { pose: { type: 'body', body: 'neptune', distance: 3.5, azimuth: 0.6, elevation: 0.2, lookShiftX: 0, lookShiftY: 0 },
          title: 'Neptun', facts: ['Sterkeste vinder i solsystemet: ~2 100 km/t', 'Ett år = 165 jordår', 'Funnet med matematikk før noen så den (1846)'] },
        { pose: { type: 'body', body: 'uranus', distance: 4, azimuth: 0.5, elevation: 0.3, lookShiftX: 0, lookShiftY: 0 },
          title: 'Uranus', facts: ['Ruller rundt Solen på siden: 98° helning', 'Kaldeste atmosfære av alle planetene: −224 °C', 'Ett år = 84 jordår'] },
        { pose: { type: 'body', body: 'saturn', distance: 4.2, azimuth: 0.6, elevation: 0.3, lookShiftX: 0, lookShiftY: 0 },
          title: 'Saturn', facts: ['Ringene er 280 000 km brede, men stort sett bare ~10 m tykke', 'Laget av is og stein', 'Saturn ville flytt i et stort nok basseng'] },
        { pose: { type: 'body', body: 'jupiter', distance: 3.5, azimuth: 0.5, elevation: 0.2, lookShiftX: 0, lookShiftY: 0 },
          title: 'Jupiter', facts: ['Tyngre enn alle de andre planetene til sammen', 'Den store røde flekken er en storm større enn Jorden', '95 kjente måner'] },
        { pose: { type: 'body', body: 'mars', distance: 3.2, azimuth: 0.5, elevation: 0.2, lookShiftX: 0, lookShiftY: 0 },
          title: 'Mars', facts: ['Olympus Mons: vulkan 22 km høy, nesten 3 × Mount Everest', 'Rød av rust (jernoksid) i støvet', 'Et døgn varer 24 t 37 min'] },
        { pose: { type: 'comet', key: 'encke', viewKm: 2.6e7, azimuth: 70, elevation: 15 },
          title: 'Komet 2P/Encke', facts: ['Rundt Solen hvert 3,3 år, kortest av de lyse kometene', 'Kilden til Tauridene: stjerneskudd i november', 'Halen peker alltid bort fra Solen'] },
        { pose: { type: 'body', body: 'sun', distance: 4.5, azimuth: 0.4, elevation: 0.15, lookShiftX: 0, lookShiftY: 0 },
          title: 'Solen', facts: ['Inneholder 99,86 % av all masse i solsystemet', 'Lyset bruker 8 min 20 s hit til Jorden', 'Kjernen holder ~15 millioner °C'] },
        { pose: { type: 'body', body: 'mercury', distance: 3.2, azimuth: 0.6, elevation: 0.2, lookShiftX: 0, lookShiftY: 0 },
          title: 'Merkur', facts: ['Minste planet, nærmest Solen', 'Fra 430 °C om dagen til −180 °C om natten', 'Ett år = 88 dager'] },
        { pose: { type: 'body', body: 'venus', distance: 3.2, azimuth: 0.6, elevation: 0.2, lookShiftX: 0, lookShiftY: 0 },
          title: 'Venus', facts: ['Varmeste planet: ~465 °C', 'Roterer baklengs, og døgnet er lengre enn året', 'Skyer av svovelsyre'] },
        { pose: { type: 'body', body: 'moon', distance: 3.2, azimuth: 0.5, elevation: 0.2, lookShiftX: 0, lookShiftY: 0 },
          title: 'Månen', facts: ['Samme side vender alltid mot oss', 'Fjerner seg ~3,8 cm fra Jorden hvert år', '12 mennesker har gått her (1969–1972)'] },
        { pose: { type: 'body', body: 'earth', distance: 3, azimuth: 0.4, elevation: 0.15, lookShiftX: 0, lookShiftY: 0 },
          title: 'Jorden', facts: ['Det eneste stedet vi vet om med liv', 'Et lyspunkt i én av hundrevis av milliarder galakser', 'Velkommen hjem'] },
      ],
    },
    explore: {
      baseFov: 40,
      // Speed = altitude × speedPerAltitude (km/s per km). Log-feel travel:
      // 1 AU → 1000 km alt ≈ ln(1.5e5) / k seconds.
      speedPerAltitude: 0.5,
      minSpeed: 0.02,       // km/s
      maxSpeed: 1e17,       // km/s (~3 kpc/s)
      boostMultiplier: 8,
      boostBlendRate: 2.2,  // 1/s, boost level eases 0 ↔ 1 (drives speed cap, FOV, tunnel)
      acceleration: 2.2,    // 1/s, exp approach to target vel
      brakeAcceleration: 6, // 1/s, reversing
      coastDamping: 0.55,   // 1/s, no input. low = long glide
      keyTurnSpeed: 0.55,
      keyPitchSpeed: 0.45,
      boostFovIncrease: 14,
      fovSpring: 30,        // 1/s², critically damped (settle ~0.6 s)
      fovRate: 5,           // 1/s, FOV ease (frame-rate independent)
      boostShakeRotation: 0.003, // × boost blend; subtle rumble, not jitter
      boostShakeFrequency: 11,
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
      bankRate: 6,          // 1/s
      capUpRate: 2.5,       // 1/s, speed cap rises (log space)
      capDownRate: 8,       // 1/s, falls (approach braking stays crisp)
      jetSoften: 0.35,      // low level: accel + boost ramp × (1 − this)
    },
    // Order must match chapterOrder (src/content/chapters.js). type:
    //   surface:   Earth lat/lon (deg), alt km, heading (deg from N), pitch (deg), lookKm (aim distance)
    //   body:      body key, distance × radius, azimuth (rad from body→sun), elevation (rad), lookShiftX/Y × radius
    //   blackhole: deep body key, distanceRs, inclination (deg from disk normal), azimuth (deg in disk plane)
    //   galactic:  pos / look in galaxy kpc (gx → sun, gz = north galactic pole)
    //   galaxy:    neighbor key, distanceKpc, inclination (deg from disk normal), azimuth (deg)
    //   nebula:    nebula key, distanceRadii, azimuth (deg from nebula→sun dir, about galactic north), elevation (deg)
    pageStops: [
      { path: '/',         type: 'galactic',  pos: [30, -14, 32], look: [0, 0, 0] }, // whole Milky Way, from outside
      { path: '/projects', type: 'blackhole', key: 'sgra', distanceRs: 30, inclination: 80, azimuth: 25 },
      { path: '/journey',  type: 'nebula',    key: 'lagoon', distanceRadii: 2.6, azimuth: 40, elevation: 15 }, // red emission nebula
      {
        path: '/contact', type: 'body', body: 'earth', distance: 3.4, azimuth: 0.75, elevation: 0.2, lookShiftX: 0.5, lookShiftY: 0,
        // Descent: over the fjord mouth, city below to the south-east.
        via: [{ type: 'surface', lat: 60.44, lon: 5.235, alt: 9, heading: 145, pitch: -30, lookKm: 20 }],
      },
      // Bergen (last): arrive high over Byfjorden facing south over the city → while reading, small drift toward it, still facing south.
      // Scroll also scrubs Bergen's time of day: sunset → night → sunrise (scroll.homeTime). Preloaded in background (far from Earth).
      {
        // heading 'sunset' / 'sunrise' = today's sun azimuth at that event, clamped to headingClamp → city always in frame,
        // sun/glow in frame when the season allows. High over Byfjorden → whole city in view, fewer fine tiles.
        path: '/chat', type: 'surface', lat: 60.44, lon: 5.29, alt: 3.6, heading: 'sunset', headingClamp: [172, 188], pitch: -18, lookKm: 9, // over Byfjorden, N of Sandviken
        hold: { lat: 60.43, lon: 5.3, alt: 3.3, heading: 178, pitch: -20, lookKm: 9 }, // ~1 km closer, city centre ahead
      },
    ],
  },

  lights: {
    ambient: { color: 0xcdd6f4, intensity: 0.08 }, // text
    // Sun light = child of sun anchor. decay 0 → no falloff, outer planets stay readable.
    // Intensity ≈ old Earth illuminance (1e5 cd / 128²).
    sun: { color: 0xf5e0dc, intensity: 6, decay: 0 }, // rosewater
  },

  // Relay (worker/, Cloudflare free tier): cached satellites, multiplayer.
  // Empty → multiplayer off, satellites straight from CelesTrak. Set VITE_RELAY_URL in .env.local / .env.production.
  relay: {
    url: (import.meta.env.VITE_RELAY_URL ?? '').replace(/\/$/, ''),
  },

  // Multiplayer: other explorers as ghost planes. Positions in nearest body's rotating frame (sim time differs per client).
  multiplayer: {
    sendHz: 4,            // while moving
    idleSendS: 5,         // heartbeat when still
    soiRadii: 60,         // inside R × this → body frame, else heliocentric ('sun')
    modelKm: 0.06,        // real-ish size
    minPx: 30,            // on-screen floor → visible from far
    smoothing: 6,         // 1/s, catch-up toward dead-reckoned target
  },

  solarSystem: {
    // Scroll mode: positions at real time (1×), spin sped up ×this. Explore: ephemerisTime.
    scrollSpinScale: 600,
    textureAnisotropy: 8,
    hiResRadii: 25,         // camera within this × radius → load the body's 4k map
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
      sunGainFar: 9,        // photosphere HDR when small on screen (blooms → glare)
      sunGainNear: 0.75,    // disc filling view: adapted exposure (granulation visible, no veil)
      coronaGain: 0.4,      // × photosphere exposure
      planetLabelRange: 2000 * AU_KM,
    },
    // Real radii, km. Positions: ephemeris (sun fixed at 0, moon custom).
    // beaconPx: min-size dot when sub-pixel. labelRange: km, hide label past it.
    // axialTiltX (Earth): −obliquity → pole = true NCP (scene (0, cos ε, −sin ε)); realSpin: rotation = GMST.
    // textureLonOffset: deg, where the texture puts real lon 0 vs our 0°-centered convention
    // (Mars map is 0–360 → 180; Venus map shifted → −60). Verified by feature overlay. Places only.
    // atmosphere: post-pass scattering (atmosphere.js). km + 1/km. Earth = standard Rayleigh/Mie.
    // sunIntensity ≈ lights.sun.intensity → sky + haze stay in balance with lit ground.
    bodies: [
      { key: 'sun',     radius: 695_700, rotationSign: 1,  axialTilt: 0.12, texture: 'sun',     emissive: true, beaconPx: 0, beaconColor: 0xf9e2af },
      { key: 'mercury', radius: 2_439.7, rotationSign: 1,  axialTilt: 0.03, texture: 'mercury', beaconPx: 3,   beaconColor: 0x9399b2 },
      { key: 'venus',   radius: 6_051.8, rotationSign: -1, axialTilt: 3.09, texture: 'venus',   beaconPx: 3.5, beaconColor: 0xfab387, atmosphere: { height: 120, betaR: [12e-3, 9e-3, 4e-3], betaM: 8e-3, Hr: 15.9, Hm: 6, g: 0.7, sunIntensity: 6 } },
      { key: 'earth',   radius: 6_371,   rotationSign: 1,  axialTilt: 0, axialTiltX: -0.40910518, realSpin: true, nightTexture: 'earthLights', nightGain: 1.6, texture: 'earth',   beaconPx: 3.5, beaconColor: 0x94e2d5, atmosphere: { height: 100, betaR: [5.802e-3, 13.558e-3, 33.1e-3], betaM: 3.996e-3, Hr: 8, Hm: 1.2, g: 0.8, sunIntensity: 7 } },
      // Moon: circular orbit, real period, tidally locked.
      { key: 'moon',    radius: 1_737.4, rotationSign: 1,  axialTilt: 0.09, texture: 'moon',    parent: 'earth', orbitRadius: 384_400, orbitInclination: 0.0898, tidallyLocked: true, beaconPx: 2.5, beaconColor: 0xa6adc8, labelRange: 5e6 },
      { key: 'mars',    radius: 3_389.5, rotationSign: 1,  axialTilt: 0.44, texture: 'mars',    beaconPx: 3,   beaconColor: 0xeba0ac, atmosphere: { height: 90, betaR: [2e-3, 1.36e-3, 0.58e-3], betaM: 4e-3, Hr: 11.1, Hm: 3, g: 0.7, sunIntensity: 5 } },
      { key: 'jupiter', radius: 69_911,  rotationSign: 1,  axialTilt: 0.05, texture: 'jupiter', beaconPx: 4,   beaconColor: 0xf9e2af, atmosphere: { height: 800, betaR: [1.2e-4, 1.6e-4, 2.4e-4], betaM: 1.5e-4, Hr: 27, Hm: 20, g: 0.7, sunIntensity: 5 } },
      // Rings: C ring inner → A ring outer. ringUv 'radial' = 1D strip texture (u = radius); else planar top-down image.
      { key: 'saturn',  radius: 58_232,  rotationSign: 1,  axialTilt: 0.47, texture: 'saturn',  ringTexture: 'saturnRing', ringUv: 'radial', ringInner: 74_500, ringOuter: 136_800, ringOpacity: 0.72, beaconPx: 4, beaconColor: 0xf5e0dc, atmosphere: { height: 900, betaR: [1.4e-4, 1.4e-4, 1.6e-4], betaM: 1.2e-4, Hr: 60, Hm: 30, g: 0.7, sunIntensity: 5 } },
      { key: 'uranus',  radius: 25_362,  rotationSign: -1, axialTilt: 1.71, texture: 'uranus',  ringTexture: 'uranusRing', ringInner: 34_100, ringOuter: 46_400, ringOpacity: 0.48, beaconPx: 3.5, beaconColor: 0x89dceb, atmosphere: { height: 600, betaR: [0.6e-4, 1.4e-4, 1.8e-4], betaM: 0.4e-4, Hr: 28, Hm: 20, g: 0.7, sunIntensity: 5 } },
      { key: 'neptune', radius: 24_622,  rotationSign: 1,  axialTilt: 0.49, texture: 'neptune', beaconPx: 3.5, beaconColor: 0x74c7ec, atmosphere: { height: 600, betaR: [0.5e-4, 1.0e-4, 2.2e-4], betaM: 0.4e-4, Hr: 20, Hm: 15, g: 0.7, sunIntensity: 5 } },
      { key: 'pluto',   radius: 1_188.3, textureLonOffset: 180, rotationSign: -1, axialTilt: 2.13, texture: 'pluto',   beaconPx: 2.5, beaconColor: 0xf2cdcd },
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
      uploadsPerFrame: 3,   // tiles made drawable per frame (smooth)
      cancelAfterFrames: 30, // unwanted in-flight load → aborted
      maxInFlight: 12,
      maxInFlightMobile: 6,
      lookaheadLevels: 3,   // prefetch under cam beyond next level (when still)
      lookaheadMaxKmS: 2,   // faster → no lookahead
      distanceFalloffKm: 40, // split threshold × (1 + dist / this)
      grazingSplit: 0.8,    // × (1 + this·(1 − cos view angle to ground)) → horizon tiles coarser
      offViewSplitScale: 4, // off-screen tiles: split threshold × this (kept coarse, ready for turning)
      offViewMargin: 0.15,  // × half diagonal FOV
      foveatedPriority: 1.5, // load order: dist × (1 + this · off-center)
      offViewPriority: 6,   // load order: off-screen dist × this
      moveCullS: 1.2,       // skip fetch if cam covers dist + tile size within this (passed before arriving)
      moveCullMinZ: 7,      // coarser always fetched
      maxReliefKm: 3,       // horizon allowance for distant peaks
      workers: 3,
      workersMobile: 2,
      activeRadii: 12,      // render distance: × Earth radius from center
      baseSinkKm: 3,        // base sphere sinks under tiles (no z-fight)
      // 3D buildings: OpenFreeMap (OpenMapTiles schema, OSM ODbL). z14 tiles around nadir.
      buildings: {
        tileJsonUrl: 'https://tiles.openfreemap.org/planet',
        maxAltKm: 8,
        radiusKm: 4,
        radiusKmMobile: 2.5,
        imageryNearKm: 1.5,  // roof imagery z16 inside, z15 beyond
        maxInFlight: 4,
        aheadPerAltKm: 1.3,  // ring center shifted toward view: alt × this ...
        aheadMaxKm: 6,       // ... capped
        moveCullS: 1.2,      // no new fetches if cam covers 2 tiles within this
      },
    },
    // Live satellites: CelesTrak GP groups → SGP4 (satellite.js) at simulated time.
    satellites: {
      // Only the well-known (labeled) ones are drawn → clean sky. Groups = where CelesTrak lists them.
      // Old full sets (visual, gps-ops, galileo, starlink lazy) dropped; relay still allows them.
      groups: [
        // opacity: far (whole globe in view) → near (≤ nearKm from Earth center) ramps to opacityNear.
        { group: 'stations', color: 0xfab387, sizePx: 3.5, opacity: 0.7, onlyLabeled: true },
        { group: 'visual', color: 0xffffff, sizePx: 3, opacity: 0.6, onlyLabeled: true },
      ],
      opacityNearKm: 9000,  // from Earth center: closer → full opacity (in orbit, sats matter)
      labeled: [
        { key: 'iss', match: '^ISS \\(ZARYA\\)', name: 'ISS', facts: ['Den internasjonale romstasjonen', '~420 km høyde, ~7,66 km/s', 'Ett omløp ≈ 92 min', 'Bemannet siden 2000'] },
        { key: 'css', match: '^CSS \\(TIANHE\\)', name: 'Tiangong', facts: ['Kinas romstasjon', '~390 km høyde'] },
        { key: 'hst', match: '^HST$', name: 'Hubble', facts: ['Romteleskop, skutt opp 1990', '~530 km høyde'] },
        { key: 'envisat', match: '^ENVISAT$', name: 'Envisat', facts: ['ESA-jordobservasjon, 8 tonn', 'Død siden 2012, ~770 km høyde'] },
      ],
      visibleKm: 400_000,   // from Earth center
      labelRangeKm: 60_000,
      trackPoints: 180,
      trackVisibleKm: 120_000,
      budget: 2500,         // SGP4 propagations per frame (rest extrapolated)
      budgetMobile: 900,
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
    // Dwarfs, nearby groups, Virgo/Fornax clusters, field galaxies (localUniverse.js). One sprite each.
    localUniverse: {
      gain: 0.9,
      sizeScale: 1,         // sprite size × galaxy radius
      mobileFactor: 0.6,
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
      lensMinPx: 2,         // Einstein radius on screen to switch ray-traced pass on
      raySteps: 260,        // geodesic steps per pixel (strong-field rays only)
      rayStepsMobile: 140,
      rayDiskGain: 0.22,    // traced disk vs mesh disk exposure
      photonRingGain: 0.9,
    },
  },
}

export default spaceConfig
