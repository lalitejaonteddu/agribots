import { useMemo } from 'react'
import * as THREE from 'three'
import { SETUP, SOIL_TOP } from '../config/setup'

/* ---------- shared materials ---------- */
export const MAT = {
  galvanised: new THREE.MeshStandardMaterial({ color: '#c9ced3', metalness: 0.75, roughness: 0.3, envMapIntensity: 2.2 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: '#3b3f44', metalness: 0.7, roughness: 0.4 }),
  blackPlastic: new THREE.MeshStandardMaterial({ color: '#1b1c1e', metalness: 0.05, roughness: 0.45 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#111213', roughness: 0.8 }),
  greyEnclosure: new THREE.MeshStandardMaterial({ color: '#9ea2a6', metalness: 0.15, roughness: 0.5 }),
  steelBracket: new THREE.MeshStandardMaterial({ color: '#a4a9ae', metalness: 0.75, roughness: 0.35, envMapIntensity: 1.8 }),
  cable: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.6 }),
}

/** A vertical galvanised tube rising `height` m above the soil, driven `embed` m into it. */
export function Pillar({ x, z, height, radius = SETUP.pillars.radius, children, name, onFloor = false }) {
  const embed = onFloor ? SOIL_TOP : SETUP.pillars.embedDepth // floor pillars start at y = 0
  const total = height + embed
  const capH = 0.035
  return (
    <group name={name} position={[x, 0, z]}>
      <mesh material={MAT.galvanised} position={[0, SOIL_TOP - embed + total / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, total, 24, 1]} />
      </mesh>
      {/* black end cap */}
      <mesh material={MAT.blackPlastic} position={[0, SOIL_TOP + height + capH / 2 - 0.004, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.18, radius * 1.18, capH, 24]} />
      </mesh>
      <mesh material={MAT.blackPlastic} position={[0, SOIL_TOP + height + capH - 0.004, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.0, radius * 1.18, 0.006, 24]} />
      </mesh>
      {onFloor ? (
        <>
          {/* square steel foot plate + weld collar */}
          <mesh material={MAT.steelBracket} position={[0, 0.004, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.008, 0.16]} />
          </mesh>
          <mesh material={MAT.steelBracket} position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[radius * 1.3, radius * 1.6, 0.025, 24]} />
          </mesh>
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => (
            <mesh key={`${a}${b}`} material={MAT.darkMetal} position={[a * 0.06, 0.01, b * 0.06]}>
              <cylinderGeometry args={[0.007, 0.007, 0.006, 6]} />
            </mesh>
          ))}
        </>
      ) : (
        /* disturbed soil collar where the tube was driven in */
        <mesh position={[0, SOIL_TOP + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <ringGeometry args={[radius, radius * 2.6, 24]} />
          <meshStandardMaterial color="#2a1d14" roughness={1} />
        </mesh>
      )}
      {children}
    </group>
  )
}

/** Hose-clamp style band around a pillar at height y (local). */
export function Clamp({ y, radius = SETUP.pillars.radius, width = 0.018 }) {
  return (
    <mesh material={MAT.darkMetal} position={[0, y, 0]} castShadow>
      <cylinderGeometry args={[radius * 1.22, radius * 1.22, width, 24]} />
    </mesh>
  )
}

/** Cable hanging from a module down the pillar into the soil. */
export function Cable({ points, radius = 0.0028 }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 48, radius, 6, false)
  }, [points, radius])
  return <mesh geometry={geometry} material={MAT.cable} castShadow />
}

function hornGeometry() {
  // profile along +Y; rotated afterwards so the horn mouth faces +Z
  const pts = [
    [0.0, 0.0],
    [0.032, 0.0],
    [0.036, 0.006],
    [0.036, 0.045],
    [0.024, 0.05],
    [0.026, 0.07],
    [0.036, 0.09],
    [0.052, 0.11],
    [0.058, 0.118],
    [0.056, 0.121],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(pts, 32)
  g.rotateX(Math.PI / 2)
  return g
}

/**
 * Weather-proof horn speaker on an L-bracket, clamped to a pillar.
 * Local frame: pillar axis at origin, +Z faces the crops.
 * `emitter` exposes the acoustic axis for future experiment code.
 */
export function SpeakerModule({ y, facing, radius = SETUP.pillars.radius }) {
  const horn = useMemo(hornGeometry, [])
  const standoff = radius + 0.05
  return (
    <group position={[0, y, 0]} rotation={[0, facing, 0]}>
      <Clamp y={0} radius={radius} width={0.03} />
      <group scale={0.78} position={[0, 0, radius * 0.22]}>
      {/* L-bracket */}
      <mesh material={MAT.steelBracket} position={[0, 0, radius + 0.022]} castShadow>
        <boxGeometry args={[0.03, 0.03, 0.045]} />
      </mesh>
      <mesh material={MAT.steelBracket} position={[0, -0.005, standoff]} castShadow>
        <boxGeometry args={[0.09, 0.006, 0.03]} />
      </mesh>
      {/* yoke arms */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={MAT.steelBracket} position={[s * 0.043, 0.02, standoff + 0.02]} castShadow>
          <boxGeometry args={[0.005, 0.05, 0.022]} />
        </mesh>
      ))}
      {/* horn, tilted slightly down toward the canopy */}
      <group position={[0, 0.025, standoff + 0.005]} rotation={[SETUP.speakers.tilt, 0, 0]}>
        <mesh geometry={horn} material={MAT.blackPlastic} castShadow>
          {/* LatheGeometry is single-sided; render inside too */}
        </mesh>
        <mesh geometry={horn} castShadow={false}>
          <meshStandardMaterial color="#0c0c0d" roughness={0.7} side={THREE.BackSide} />
        </mesh>
        {/* phase plug */}
        <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.012, 0.03, 16]} />
          <meshStandardMaterial color="#2a2a2c" roughness={0.5} metalness={0.3} />
        </mesh>
        <group name="speaker-emitter" position={[0, 0, 0.12]} userData={{ acousticAxis: [0, 0, 1] }} />
      </group>
      </group>
    </group>
  )
}

/** Small IP65 sensor enclosure (e.g. temperature/humidity/light) strapped to a pillar. */
export function SensorModule({ y, facing, radius = SETUP.pillars.radius }) {
  return (
    <group position={[0, y, 0]} rotation={[0, facing, 0]}>
      <Clamp y={0.03} radius={radius} />
      <Clamp y={-0.03} radius={radius} />
      <mesh material={MAT.greyEnclosure} position={[0, 0, radius + 0.026]} castShadow>
        <boxGeometry args={[0.07, 0.09, 0.048]} />
      </mesh>
      <mesh material={MAT.greyEnclosure} position={[0, 0, radius + 0.051]} castShadow>
        <boxGeometry args={[0.064, 0.084, 0.004]} />
      </mesh>
      {/* sensor window + status LED */}
      <mesh position={[0, 0.015, radius + 0.0535]}>
        <circleGeometry args={[0.011, 20]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.2} />
      </mesh>
      <mesh position={[0.022, -0.03, radius + 0.0535]}>
        <circleGeometry args={[0.003, 12]} />
        <meshStandardMaterial color="#38d26a" emissive="#38d26a" emissiveIntensity={2} />
      </mesh>
      {/* cable gland */}
      <mesh material={MAT.blackPlastic} position={[0, -0.05, radius + 0.026]} castShadow>
        <cylinderGeometry args={[0.007, 0.008, 0.014, 12]} />
      </mesh>
    </group>
  )
}
