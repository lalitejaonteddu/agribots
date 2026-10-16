import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { SETUP, SOIL_TOP, CORNER_PILLARS } from '../config/setup'
import { EXPERIMENT } from './experimentConfig'

const TILT = SETUP.speakers.tilt // same value drives the horn tilt in scene/Hardware.jsx

/** World-space position and acoustic axis of a corner speaker's horn mouth. */
export function speakerPose(pillarId) {
  const p = CORNER_PILLARS.find((c) => c.id === pillarId)
  const f = Math.atan2(-p.x, -p.z)
  const s = 0.78 // module scale in Hardware.jsx
  const d = SETUP.pillars.radius * 1.22 + s * (SETUP.pillars.radius + 0.055 + 0.12 * Math.cos(TILT))
  const y = SOIL_TOP + SETUP.speakers.mountHeight + s * (0.025 - 0.12 * Math.sin(TILT))
  return {
    position: new THREE.Vector3(p.x + Math.sin(f) * d, y, p.z + Math.cos(f) * d),
    axis: new THREE.Vector3(Math.sin(f) * Math.cos(TILT), -Math.sin(TILT), Math.cos(f) * Math.cos(TILT)).normalize(),
  }
}

function Rings({ position, axis, active, color }) {
  const group = useRef()
  const rings = useRef([])
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis), [axis])
  useFrame(({ clock }) => {
    rings.current.forEach((m, i) => {
      if (!m) return
      const t = (clock.elapsedTime * 0.6 + i / 4) % 1
      m.position.set(0, 0, t * 0.55)
      const s = 0.05 + t * 0.32
      m.scale.set(s, s, s)
      m.material.opacity = active ? (1 - t) * 0.45 : 0
    })
  })
  return (
    <group ref={group} position={position} quaternion={quat}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} renderOrder={8}>
          <ringGeometry args={[0.92, 1, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* acoustic axis */}
      <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.6 : 0.25} />
      </mesh>
    </group>
  )
}

/**
 * Illustrative speaker overlays: acoustic axis + expanding rings when a speaker is marked active.
 * This is a visual indicator of configuration only — there is no acoustic propagation model.
 */
export default function SpeakerEmitters({ demoActive }) {
  return EXPERIMENT.speakers.map((s) => {
    const { position, axis } = speakerPose(s.pillar)
    const zone = EXPERIMENT.zones.find((z) => z.id === s.zone)
    const active = s.enabled || (demoActive && zone?.role === 'treated')
    const color = zone?.color ?? '#888'
    return (
      <group key={s.id}>
        <Rings position={position} axis={axis} active={active} color={color} />
        <Html position={position.clone().add(new THREE.Vector3(0, 0.09, 0))} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`spk-tag ${active ? 'on' : ''}`} style={{ '--zc': color }}>
            {s.id} · {(s.frequencyHz / 1000).toFixed(1)} kHz · {active ? 'ON' : 'off'}
          </div>
        </Html>
      </group>
    )
  })
}
