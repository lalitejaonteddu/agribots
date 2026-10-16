import { useMemo, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { SETUP, INNER_LENGTH, INNER_WIDTH, SOIL_TOP } from '../config/setup'
import { soilMaps } from '../utils/textures'
import { mulberry32, range, fbm } from '../utils/random'
import { soilHeight } from './fieldLayout'
import { wallBulge } from './Planter'

const SEG_X = 160
const SEG_Z = 80

function buildSoilGeometry() {
  const g = new THREE.PlaneGeometry(INNER_LENGTH, INNER_WIDTH, SEG_X, SEG_Z)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  const colors = new Float32Array(p.count * 3)
  const vSoil = SOIL_TOP / SETUP.planter.height
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i)
    let z = p.getZ(i)
    const onX = Math.abs(Math.abs(x) - INNER_LENGTH / 2) < 1e-4
    const onZ = Math.abs(Math.abs(z) - INNER_WIDTH / 2) < 1e-4
    const y = soilHeight(x, z)
    // follow the bowed walls so no gap opens between soil and cardboard
    if (onZ) z += Math.sign(z) * wallBulge(x / INNER_LENGTH + 0.5, vSoil)
    if (onX) x += Math.sign(x) * wallBulge(z / INNER_WIDTH + 0.5, vSoil)
    p.setXYZ(i, x, y, z)

    // moisture / organic-matter variation
    const m = fbm(x * 2.5, z * 2.5, 3, 31) + 0.5
    const fine = fbm(x * 14, z * 14, 2, 77)
    c.setRGB(0.27 + 0.09 * m + fine * 0.05, 0.19 + 0.05 * m + fine * 0.03, 0.135 + 0.025 * m, THREE.SRGBColorSpace)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

/** Small clods and pebbles scattered on the surface. */
function Clods() {
  const ref = useRef()
  const count = 900
  const geometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), [])
  useLayoutEffect(() => {
    const rand = mulberry32(41)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const col = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const x = range(rand, -INNER_LENGTH / 2 + 0.02, INNER_LENGTH / 2 - 0.02)
      const z = range(rand, -INNER_WIDTH / 2 + 0.02, INNER_WIDTH / 2 - 0.02)
      const pebble = rand() < 0.12
      const s = pebble ? range(rand, 0.003, 0.007) : range(rand, 0.003, 0.014) * (rand() < 0.08 ? 1.8 : 1)
      e.set(rand() * 6, rand() * 6, rand() * 6)
      q.setFromEuler(e)
      m.compose(
        new THREE.Vector3(x, soilHeight(x, z) + s * 0.25, z),
        q,
        new THREE.Vector3(s, s * range(rand, 0.55, 0.9), s * range(rand, 0.8, 1.2)),
      )
      ref.current.setMatrixAt(i, m)
      if (pebble) col.setRGB(0.38 + rand() * 0.12, 0.34 + rand() * 0.08, 0.29 + rand() * 0.06)
      else col.setRGB(0.15 + rand() * 0.08, 0.1 + rand() * 0.05, 0.065 + rand() * 0.03)
      ref.current.setColorAt(i, col)
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.instanceColor.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.95} />
    </instancedMesh>
  )
}

export default function Soil() {
  const geometry = useMemo(buildSoilGeometry, [])
  const { map, bumpMap } = soilMaps()
  return (
    <group name="soil">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          map={map}
          bumpMap={bumpMap}
          bumpScale={1.6}
          vertexColors
          roughness={0.97}
          color="#ffffff"
        />
      </mesh>
      <Clods />
    </group>
  )
}
