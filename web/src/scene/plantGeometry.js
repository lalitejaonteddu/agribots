import * as THREE from 'three'
import { mulberry32, range } from '../utils/random'

/**
 * Procedural young maize plant (V6–V10 stage): a tapered, slightly leaning stem with
 * alternating strap leaves that arch and droop, plus a tight whorl of upright leaves on top.
 * All geometry is generated in world space so the whole field can be merged into two draws.
 */

const UP = new THREE.Vector3(0, 1, 0)
const tmpC = new THREE.Color()

function srgb(r, g, b) {
  return tmpC.setRGB(r, g, b, THREE.SRGBColorSpace).clone()
}

function stemCenter(plant, y, hs) {
  const t = Math.max(0, y) / hs
  return new THREE.Vector3(plant.lean[0] * t * t, y, plant.lean[1] * t * t)
}

function buildStem(plant, base, hs, r0, r1, color) {
  const radial = 10
  const g = new THREE.CylinderGeometry(r1, r0, hs, radial, 10, true)
  g.translate(0, hs / 2, 0)
  g.deleteAttribute('uv')
  const p = g.attributes.position
  const colors = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const c = stemCenter(plant, y, hs)
    p.setXYZ(i, p.getX(i) + c.x + base.x, y + base.y, p.getZ(i) + c.z + base.z)
    const k = y / hs
    // purple-ish tinge at the base, pale green higher up
    const col = color.clone().lerp(srgb(0.45, 0.42, 0.22), Math.max(0, 0.35 - k) * 1.4)
    colors.set([col.r, col.g, col.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

/**
 * One strap leaf. `elev` = initial angle above horizontal, `droop` = total bend (rad)
 * applied along the blade, so the tip angle is elev - droop.
 */
function buildLeaf({ origin, phi, elev, droop, length, width, twist, curl, color, rand }) {
  const NA = 28
  const ACROSS = [-1, -0.55, 0, 0.55, 1]
  const NC = ACROSS.length
  const positions = new Float32Array((NA + 1) * NC * 3)
  const colors = new Float32Array((NA + 1) * NC * 3)
  const d = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi))
  const s0 = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi))
  const pos = origin.clone()
  const step = length / NA
  const T = new THREE.Vector3()
  const S = new THREE.Vector3()
  const N = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const wavePhase = rand() * 10
  const waveFreq = range(rand, 45, 70)
  const mid = srgb(0.62, 0.74, 0.42)
  const tipCol = color.clone().lerp(srgb(0.62, 0.66, 0.3), 0.35)
  const edgeCol = color.clone().lerp(srgb(0.2, 0.36, 0.1), 0.3)

  for (let i = 0; i <= NA; i++) {
    const t = i / NA
    const a = elev - droop * Math.pow(t, 1.5)
    // slight sideways curve of the blade
    const dd = d.clone().applyAxisAngle(UP, curl * t)
    T.copy(dd).multiplyScalar(Math.cos(a)).addScaledVector(UP, Math.sin(a)).normalize()
    if (i > 0) pos.addScaledVector(T, step)

    // rotate the side vector around the tangent to twist the blade
    const s0r = s0.clone().applyAxisAngle(UP, curl * t)
    const tw = twist * t
    tmp.crossVectors(T, s0r).normalize()
    S.copy(s0r).multiplyScalar(Math.cos(tw)).addScaledVector(tmp, Math.sin(tw)).normalize()
    N.crossVectors(S, T).normalize()

    const w =
      width * Math.min(1, 0.32 + t * 4.2) * Math.pow(Math.max(0, 1 - t), 0.6) // clasping base, pointed tip
    for (let j = 0; j < NC; j++) {
      const k = ACROSS[j]
      const fold = -0.12 * w * (1 - Math.abs(k)) // midrib channel
      const wave = t > 0.18 ? 0.0032 * Math.pow(Math.abs(k), 3) * Math.sin(t * waveFreq + wavePhase + k * 2) : 0
      const cupping = 0.12 * w * k * k // margins lift slightly
      const p = pos
        .clone()
        .addScaledVector(S, (k * w) / 2)
        .addScaledVector(N, fold + wave + cupping)
      positions.set([p.x, p.y, p.z], (i * NC + j) * 3)

      let col = color.clone().lerp(tipCol, Math.pow(t, 3))
      if (k === 0) col = col.lerp(mid, 0.55 * (1 - t * 0.6))
      else if (Math.abs(k) === 1) col = col.lerp(edgeCol, 0.5)
      colors.set([col.r, col.g, col.b], (i * NC + j) * 3)
    }
  }

  const index = []
  for (let i = 0; i < NA; i++) {
    for (let j = 0; j < NC - 1; j++) {
      const a = i * NC + j
      const b = a + 1
      const c = a + NC
      const e = c + 1
      index.push(a, c, b, b, c, e)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

/**
 * @param plant  { x, z, height, phase, seed }
 * @param baseY  soil height at the stem
 * @returns {{ leaves: THREE.BufferGeometry[], stems: THREE.BufferGeometry[] }}
 */
export function buildPlant(plant, baseY, { seedling = false } = {}) {
  const rand = mulberry32(plant.seed)
  const H = plant.height
  const base = new THREE.Vector3(plant.x, baseY - 0.01, plant.z)
  const p = { ...plant, lean: [range(rand, -0.04, 0.04) * H, range(rand, -0.04, 0.04) * H] }

  const leafGreen = srgb(range(rand, 0.25, 0.33), range(rand, 0.5, 0.58), range(rand, 0.13, 0.19))
  const leaves = []
  const stems = []

  if (seedling) {
    const n = 3 + Math.floor(rand() * 3)
    for (let i = 0; i < n; i++) {
      leaves.push(
        buildLeaf({
          origin: base.clone().add(new THREE.Vector3(0, 0.01, 0)),
          phi: plant.phase + i * 2.4,
          elev: range(rand, 0.9, 1.3),
          droop: range(rand, 0.8, 1.6),
          length: H * range(rand, 0.9, 1.3),
          width: range(rand, 0.01, 0.016),
          twist: range(rand, -0.5, 0.5),
          curl: range(rand, -0.3, 0.3),
          color: leafGreen,
          rand,
        }),
      )
    }
    return { leaves, stems }
  }

  const hs = H * range(rand, 0.55, 0.62) // visible stalk height
  const r0 = 0.009 + 0.008 * H
  const r1 = r0 * 0.55
  stems.push(buildStem(p, base, hs, r0, r1, srgb(0.42, 0.58, 0.24)))

  const nLeaves = Math.round(4 + H * 3.5)
  for (let i = 0; i < nLeaves; i++) {
    const f = (i + 0.6) / nLeaves // 0 = lowest leaf
    const y = hs * (0.04 + 0.96 * Math.pow(f, 1.25))
    const c = stemCenter(p, y, hs)
    const origin = base.clone().add(c)
    const phi = plant.phase + (i % 2) * Math.PI + range(rand, -0.45, 0.45) + i * 0.09
    // leaves are longest in the middle of the plant
    const lenFactor = 0.42 + 0.48 * Math.sin(Math.PI * (0.2 + f * 0.75))
    leaves.push(
      buildLeaf({
        origin,
        phi,
        elev: range(rand, 0.9, 1.15) + f * 0.25,
        droop: range(rand, 1.4, 2.0) - f * 0.55,
        length: H * lenFactor * range(rand, 0.82, 0.98),
        width: (0.05 + 0.035 * H) * range(rand, 0.85, 1.1),
        twist: range(rand, -0.8, 0.8),
        curl: range(rand, -0.35, 0.35),
        color: leafGreen.clone().lerp(srgb(0.36, 0.5, 0.18), (1 - f) * 0.35),
        rand,
      }),
    )
  }

  // whorl: young rolled leaves standing up to the full plant height
  const top = base.clone().add(stemCenter(p, hs, hs))
  for (let i = 0; i < 3; i++) {
    const elev = range(rand, 1.2, 1.42)
    const len = ((H - hs) / Math.sin(elev)) * range(rand, 1.0, 1.12)
    leaves.push(
      buildLeaf({
        origin: top.clone().add(new THREE.Vector3(0, -0.02 * i, 0)),
        phi: plant.phase + i * 2.1 + 0.6,
        elev,
        droop: range(rand, 0.25, 0.7) * (i === 0 ? 0.5 : 1),
        length: len,
        width: (0.03 + 0.025 * H) * (1 - i * 0.15),
        twist: range(rand, -0.6, 0.6),
        curl: range(rand, -0.2, 0.2),
        color: leafGreen.clone().lerp(srgb(0.45, 0.66, 0.24), 0.45),
        rand,
      }),
    )
  }
  return { leaves, stems }
}
