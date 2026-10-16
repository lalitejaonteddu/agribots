import { SETUP, SOIL_TOP, INNER_LENGTH, INNER_WIDTH, CORNER_PILLARS } from '../config/setup'
import { mulberry32, range, fbm } from '../utils/random'

/**
 * Where each crop stands and how tall it is. Shared by the crop geometry,
 * the soil (mounds around stems) and future experiment code (zone stats, insect hosts).
 */
function buildLayout() {
  const { rows, perRow, seed, minHeight, maxHeight } = SETUP.crops
  const rand = mulberry32(seed)
  const plants = []
  const obstacles = [
    { x: SETUP.mast.position[0], z: SETUP.mast.position[1], r: 0.11 },
    ...CORNER_PILLARS.map((p) => ({ x: p.x, z: p.z, r: 0.1 })),
  ]
  const usableL = INNER_LENGTH - 0.3
  const usableW = INNER_WIDTH * 0.5
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < perRow; c++) {
      const stagger = r % 2 ? 0.5 : 0
      const u = (c + 0.5 + stagger * 0.6) / perRow
      let x = -usableL / 2 + u * usableL + range(rand, -0.035, 0.035)
      let z = -usableW / 2 + (r / (rows - 1)) * usableW + range(rand, -0.03, 0.03)
      if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)) {
        // nudge away from the mast instead of dropping the plant
        x += x >= 0 ? 0.13 : -0.13
        if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)) continue
      }
      // taller toward the middle of the bed, like the reference
      const centrality = 1 - Math.abs(x) / (INNER_LENGTH / 2)
      const t = Math.min(1, Math.max(0, 0.25 + 0.55 * rand() + 0.25 * centrality))
      plants.push({
        id: `P${r + 1}-${c + 1}`,
        row: r,
        x,
        z,
        height: minHeight + t * (maxHeight - minHeight),
        phase: rand() * Math.PI * 2,
        seed: Math.floor(rand() * 1e9),
      })
    }
  }
  // make sure the full modelled range is represented
  const sorted = [...plants].sort((a, b) => a.height - b.height)
  sorted[0].height = minHeight
  sorted[sorted.length - 1].height = maxHeight

  // a few small volunteer seedlings in the gaps (not counted as crops)
  const seedlings = []
  for (let i = 0; i < 14; i++) {
    const x = range(rand, -INNER_LENGTH / 2 + 0.08, INNER_LENGTH / 2 - 0.08)
    const z = range(rand, -INNER_WIDTH / 2 + 0.07, INNER_WIDTH / 2 - 0.07)
    const tooClose =
      plants.some((p) => Math.hypot(p.x - x, p.z - z) < 0.09) ||
      obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r)
    if (tooClose) continue
    seedlings.push({ id: `S${i}`, x, z, height: range(rand, 0.08, 0.2), phase: rand() * 6.28, seed: Math.floor(rand() * 1e9) })
  }
  return { plants, seedlings }
}

export const FIELD = buildLayout()

/** Soil surface height (world Y) at (x, z). */
export function soilHeight(x, z) {
  let y = SOIL_TOP + fbm(x * 3.2, z * 3.2, 4, 9) * 0.022 + fbm(x * 18, z * 18, 2, 4) * 0.006
  // slight mounding where the soil was firmed around each stem
  for (const p of FIELD.plants) {
    const d2 = (p.x - x) ** 2 + (p.z - z) ** 2
    y += 0.016 * Math.exp(-d2 / 0.0035)
  }
  // soil settles a little lower along the walls
  const ex = INNER_LENGTH / 2 - Math.abs(x)
  const ez = INNER_WIDTH / 2 - Math.abs(z)
  const edge = Math.min(ex, ez)
  y -= 0.01 * Math.exp(-Math.max(edge, 0) / 0.03)
  return y
}
