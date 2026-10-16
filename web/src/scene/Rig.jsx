import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PerspectiveCamera } from '@react-three/drei'
import {
  SETUP,
  SOIL_TOP,
  CORNER_PILLARS,
  PILLARS_ON_FLOOR,
  MAST_TOP,
  LENS_POSITION,
  LENS_TARGET,
} from '../config/setup'
import { EXPERIMENT } from '../experiment/experimentConfig'
import { Pillar, Clamp, Cable, SpeakerModule, SensorModule, MAT } from './Hardware'

const facingToCentre = (x, z) => Math.atan2(-x, -z)

/** Four free-standing corner pillars (no horizontal frame), with optional modules. */
function CornerPillars({ showSpeakers }) {
  return CORNER_PILLARS.map((p) => {
    const facing = facingToCentre(p.x, p.z)
    const speaker = EXPERIMENT.speakers.find((s) => s.pillar === p.id)
    const sensor = EXPERIMENT.sensors.find((s) => s.pillar === p.id)
    const yS = SOIL_TOP + SETUP.speakers.mountHeight
    const r = SETUP.pillars.radius
    const base = PILLARS_ON_FLOOR ? 0.035 : SOIL_TOP
    return (
      <Pillar
        key={p.id}
        name={`pillar-${p.id}`}
        x={p.x}
        z={p.z}
        height={SETUP.pillars.cornerHeight}
        onFloor={PILLARS_ON_FLOOR}
      >
        <Clamp y={SOIL_TOP + 0.62} />
        {showSpeakers && speaker && (
          <group rotation={[0, facing, 0]}>
            <SpeakerModule y={yS} facing={0} />
            <Cable
              points={[
                [0, yS - 0.005, r + 0.025],
                [0.004, yS - 0.07, r + 0.02],
                [0.006, yS - 0.25, r + 0.006],
                [0.004, SOIL_TOP + 0.3, r + 0.004],
                [0.0, base + 0.06, r + 0.006],
                [0.0, base + 0.004, r + 0.07],
              ]}
            />
          </group>
        )}
        {sensor && (
          <group rotation={[0, facing, 0]}>
            <SensorModule y={SOIL_TOP + sensor.mountHeight} facing={0} />
            <Cable
              points={[
                [0, SOIL_TOP + sensor.mountHeight - 0.057, r + 0.026],
                [0, SOIL_TOP + sensor.mountHeight - 0.12, r + 0.018],
                [-0.006, SOIL_TOP + 0.35, r + 0.005],
                [-0.004, base + 0.06, r + 0.006],
                [-0.01, base + 0.004, r + 0.08],
              ]}
            />
          </group>
        )}
      </Pillar>
    )
  })
}

/** Industrial box camera with rain hood, hanging lens-down from an offset arm. */
function MastCamera() {
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current.position.set(...LENS_POSITION)
    ref.current.lookAt(...LENS_TARGET) // Object3D.lookAt points local +Z at the target
  }, [])

  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0a0d12',
        metalness: 0.2,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        iridescence: 0.5,
      }),
    [],
  )
  const housing = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2c2f33', metalness: 0.55, roughness: 0.38 }),
    [],
  )

  const bodyLen = 0.15
  const zBody = -0.03 - bodyLen / 2
  return (
    <group ref={ref} name="mast-camera">
      {/* the virtual camera sits just in front of the glass, so shift the hardware back */}
      <group position={[0, 0, -0.025]}>
      {/* housing */}
      <mesh material={housing} position={[0, 0, zBody]} castShadow>
        <boxGeometry args={[0.072, 0.072, bodyLen]} />
      </mesh>
      {/* cooling ribs */}
      {[-0.024, -0.008, 0.008, 0.024].map((x) => (
        <mesh key={x} material={housing} position={[x, 0.038, zBody - 0.01]} castShadow>
          <boxGeometry args={[0.004, 0.006, bodyLen * 0.75]} />
        </mesh>
      ))}
      {/* front bezel */}
      <mesh material={MAT.darkMetal} position={[0, 0, -0.027]} castShadow>
        <boxGeometry args={[0.078, 0.078, 0.008]} />
      </mesh>
      {/* lens barrel + focus ring + glass */}
      <mesh material={MAT.blackPlastic} position={[0, 0, -0.005]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.028, 0.04, 32]} />
      </mesh>
      <mesh material={MAT.rubber} position={[0, 0, -0.008]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0295, 0.0295, 0.012, 32]} />
      </mesh>
      <mesh material={MAT.darkMetal} position={[0, 0, 0.0155]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.022, 0.0035, 10, 32]} />
      </mesh>
      <mesh material={glass} position={[0, 0, 0.016]}>
        <circleGeometry args={[0.021, 32]} />
      </mesh>
      {/* rear cap with M12 connector */}
      <mesh material={MAT.darkMetal} position={[0, 0, zBody - bodyLen / 2 - 0.004]} castShadow>
        <boxGeometry args={[0.066, 0.066, 0.008]} />
      </mesh>
      <mesh material={MAT.galvanised} position={[0.016, 0, zBody - bodyLen / 2 - 0.016]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.018, 16]} />
      </mesh>
      {/* status LED */}
      <mesh position={[0.026, -0.026, -0.0225]}>
        <circleGeometry args={[0.003, 12]} />
        <meshStandardMaterial color="#ff4040" emissive="#ff2020" emissiveIntensity={3} />
      </mesh>
      {/* rain / sun hood over the top of the camera */}
      <mesh material={MAT.blackPlastic} position={[0, 0, zBody - bodyLen / 2 - 0.03]} rotation={[-Math.PI / 2, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.1, 0.045, 4, 1, true]} />
      </mesh>
      <mesh position={[0, 0, zBody - bodyLen / 2 - 0.03]} rotation={[-Math.PI / 2, Math.PI / 4, 0]}>
        <coneGeometry args={[0.1, 0.045, 4, 1, true]} />
        <meshStandardMaterial color="#141416" roughness={0.6} side={THREE.BackSide} />
      </mesh>
      </group>
    </group>
  )
}

/** Central mast: tube, offset arm, pan-tilt block and the camera. */
function CentralMast() {
  const [mx, mz] = SETUP.mast.position
  const r = SETUP.mast.radius
  const armY = MAST_TOP - 0.03
  const armStart = -r
  const armEnd = -(SETUP.mast.armLength - 0.04)
  const armLen = armStart - armEnd
  return (
    <group name="central-mast">
      <Pillar x={mx} z={mz} height={SETUP.mast.height} radius={r} name="pillar-mast">
        <Clamp y={SOIL_TOP + 1.05} radius={r} />
        <Clamp y={armY} radius={r} width={0.04} />
        {/* offset arm */}
        <mesh material={MAT.steelBracket} position={[0, armY, armStart - armLen / 2]} castShadow>
          <boxGeometry args={[0.025, 0.025, armLen]} />
        </mesh>
        {/* pan-tilt joint */}
        <mesh material={MAT.darkMetal} position={[0, armY, armEnd]} castShadow>
          <sphereGeometry args={[0.018, 20, 16]} />
        </mesh>
        <mesh material={MAT.steelBracket} position={[0, armY - 0.01, armEnd - 0.006]} castShadow>
          <boxGeometry args={[0.05, 0.05, 0.008]} />
        </mesh>
        <Cable
          points={[
            [0.016, MAST_TOP + 0.075, LENS_POSITION[2] - 0.012],
            [0.02, MAST_TOP + 0.07, -0.08],
            [0.01, MAST_TOP - 0.05, -r - 0.01],
            [0.0, SOIL_TOP + 1.0, -r - 0.005],
            [0.0, SOIL_TOP + 0.02, -r - 0.012],
            [0.0, SOIL_TOP - 0.03, -r - 0.02],
          ]}
        />
      </Pillar>
      <MastCamera />
    </group>
  )
}

/**
 * The virtual camera that sits in the physical camera's lens.
 * When `active`, it becomes the scene's default camera ("Camera View").
 */
export function MastViewCamera({ active }) {
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current.position.set(...LENS_POSITION)
    ref.current.up.set(0, 1, 0)
    ref.current.lookAt(...LENS_TARGET)
    ref.current.updateMatrixWorld()
  }, [])
  return (
    <PerspectiveCamera
      ref={ref}
      makeDefault={active}
      fov={SETUP.camera.fov}
      near={SETUP.camera.near}
      far={SETUP.camera.far}
    />
  )
}

export default function Rig({ showSpeakers = true }) {
  return (
    <group name="rig">
      <CornerPillars showSpeakers={showSpeakers} />
      <CentralMast />
    </group>
  )
}
