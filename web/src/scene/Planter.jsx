import { useMemo } from 'react'
import * as THREE from 'three'
import { SETUP } from '../config/setup'
import { cardboardMaps, fluteEdgeMap } from '../utils/textures'

const { length: L, width: W, height: H, wallThickness: T } = SETUP.planter
const BULGE = 0.008 // m — outward bow of each wall under soil load

/**
 * Outward bow of a cardboard wall.
 * u ∈ [0,1] along the wall (0 and 1 are the stiff corners), v ∈ [0,1] from floor to rim.
 */
export function wallBulge(u, v) {
  const along = Math.pow(Math.sin(Math.PI * THREE.MathUtils.clamp(u, 0, 1)), 0.85)
  const up = Math.sin(Math.PI * THREE.MathUtils.clamp(v, 0, 1)) * (1 - 0.35 * v)
  return BULGE * along * up
}

function wallGeometry(len) {
  const g = new THREE.BoxGeometry(len, H, T, 48, 12, 1)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / len + 0.5
    const v = p.getY(i) / H + 0.5
    p.setZ(i, p.getZ(i) + wallBulge(u, v))
  }
  g.computeVertexNormals()
  return g
}

function useWallMaterials(len) {
  return useMemo(() => {
    const outer = cardboardMaps('outer')
    const inner = cardboardMaps('inner')
    const rep = (tex, x) => {
      const t = tex.clone()
      t.repeat.set(x, 1)
      t.needsUpdate = true
      return t
    }
    const flute = fluteEdgeMap().clone()
    flute.repeat.set(len * 7.8, 1)
    flute.needsUpdate = true

    const outerMat = new THREE.MeshStandardMaterial({
      map: rep(outer.map, len),
      bumpMap: rep(outer.bumpMap, len),
      bumpScale: 0.6,
      roughness: 0.88,
      metalness: 0,
    })
    const innerMat = new THREE.MeshStandardMaterial({
      map: rep(inner.map, len),
      bumpMap: rep(inner.bumpMap, len),
      bumpScale: 0.5,
      roughness: 0.92,
    })
    const rimMat = new THREE.MeshStandardMaterial({ map: flute, roughness: 0.95 })
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#a97f4e', roughness: 0.95 })
    // BoxGeometry groups: +x, -x, +y (rim), -y, +z (outside), -z (inside)
    return [edgeMat, edgeMat, rimMat, edgeMat, outerMat, innerMat]
  }, [len])
}

function Wall({ len, position, rotationY }) {
  const geometry = useMemo(() => wallGeometry(len), [len])
  const materials = useWallMaterials(len)
  return (
    <mesh
      geometry={geometry}
      material={materials}
      position={position}
      rotation={[0, rotationY, 0]}
      castShadow
      receiveShadow
    />
  )
}

/** Brown packing tape folded over each vertical outside corner. */
function CornerTape({ x, z }) {
  const tapeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#a8763f',
        roughness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.3,
        transparent: true,
        opacity: 0.82,
      }),
    [],
  )
  const sx = Math.sign(x)
  const sz = Math.sign(z)
  const w = 0.045
  const h = H - 0.006
  const eps = 0.0012
  return (
    <group>
      {/* face along the long wall */}
      <mesh
        material={tapeMat}
        position={[x - sx * (w / 2), H / 2, z + sz * eps]}
        rotation={[0, sz > 0 ? 0 : Math.PI, 0]}
      >
        <planeGeometry args={[w, h]} />
      </mesh>
      {/* face along the short wall */}
      <mesh
        material={tapeMat}
        position={[x + sx * eps, H / 2, z - sz * (w / 2)]}
        rotation={[0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
      >
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  )
}

/** Open-top corrugated cardboard planter, 2.0 × 1.0 × 0.3 m (outer). */
export default function Planter() {
  const shortLen = W - 2 * T
  return (
    <group name="planter">
      <Wall len={L} position={[0, H / 2, W / 2 - T / 2]} rotationY={0} />
      <Wall len={L} position={[0, H / 2, -W / 2 + T / 2]} rotationY={Math.PI} />
      <Wall len={shortLen} position={[L / 2 - T / 2, H / 2, 0]} rotationY={Math.PI / 2} />
      <Wall len={shortLen} position={[-L / 2 + T / 2, H / 2, 0]} rotationY={-Math.PI / 2} />
      {/* base sheet (hidden under the soil, keeps the box closed from below) */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[L - 2 * T, W - 2 * T]} />
        <meshStandardMaterial color="#9c7446" roughness={0.95} />
      </mesh>
      {[
        [L / 2, W / 2],
        [-L / 2, W / 2],
        [L / 2, -W / 2],
        [-L / 2, -W / 2],
      ].map(([x, z]) => (
        <CornerTape key={`${x}${z}`} x={x} z={z} />
      ))}
    </group>
  )
}
