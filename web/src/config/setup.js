/**
 * Physical specification of the testbed.
 * Scale: 1 world unit = 1 metre. Y is up. The floor is y = 0.
 * X runs along the planter LENGTH, Z along its WIDTH. The planter is centred on the origin.
 *
 * Everything in the scene (geometry, dimension labels, virtual camera) is derived from
 * these numbers, so editing them here keeps the model and the measurements consistent.
 */
export const SETUP = {
  planter: {
    length: 2.0, // m (outer, X)
    width: 1.0, // m (outer, Z)
    height: 0.3, // m (outer wall height)
    wallThickness: 0.009, // m — double-wall corrugated board
  },
  soil: {
    depth: 0.25, // m — within the 0.2–0.3 m spec, leaves a 5 cm rim
  },
  crops: {
    minHeight: 0.3, // m above soil
    maxHeight: 0.8, // m above soil
    rows: 2,
    perRow: 6,
    seed: 7,
  },
  pillars: {
    radius: 0.0215, // m — 43 mm OD galvanised tube
    cornerHeight: 2.0, // m above soil surface
    // pillars stand on the floor just OUTSIDE each corner of the box (negative = outside)
    cornerInset: -0.045, // m from outer wall to pillar centre
    embedDepth: 0.2, // m driven into the soil (hidden)
  },
  mast: {
    radius: 0.0215,
    height: 2.0, // m above soil surface
    position: [0, 0], // [x, z] — centre of the bed
    armLength: 0.16, // m — offset arm so the lens sees past its own mast
  },
  camera: {
    fov: 42, // vertical FOV of the virtual mast camera (deg)
    aspect: 16 / 9,
    near: 0.03,
    far: 30,
  },
  speakers: {
    mountHeight: 1.0, // m above soil on each corner pillar
    tilt: 0.42, // rad — emitters angled down toward the middle of the bed
  },
}

// ---------- derived values ----------
export const SOIL_TOP = SETUP.soil.depth
export const INNER_LENGTH = SETUP.planter.length - 2 * SETUP.planter.wallThickness
export const INNER_WIDTH = SETUP.planter.width - 2 * SETUP.planter.wallThickness

const hx = SETUP.planter.length / 2 - SETUP.pillars.cornerInset
const hz = SETUP.planter.width / 2 - SETUP.pillars.cornerInset

/** True when corner pillars stand on the floor outside the box rather than in the soil. */
export const PILLARS_ON_FLOOR = SETUP.pillars.cornerInset < 0

/** Corner pillar ids follow compass-style naming when viewed from the default (front) view. */
export const CORNER_PILLARS = [
  { id: 'FL', label: 'Front-left', x: -hx, z: hz },
  { id: 'FR', label: 'Front-right', x: hx, z: hz },
  { id: 'BR', label: 'Back-right', x: hx, z: -hz },
  { id: 'BL', label: 'Back-left', x: -hx, z: -hz },
]

export const MAST_TOP = SOIL_TOP + SETUP.mast.height

/** World position of the mast camera's lens and the point it is aimed at. */
export const LENS_POSITION = [
  SETUP.mast.position[0],
  MAST_TOP - 0.14,
  SETUP.mast.position[1] - SETUP.mast.armLength,
]
export const LENS_TARGET = [SETUP.mast.position[0], SOIL_TOP, SETUP.mast.position[1]]
