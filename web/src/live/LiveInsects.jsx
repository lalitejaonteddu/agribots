import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SOIL_TOP } from '../config/setup'
import InsectPhotoCard, { getSpeciesColor } from './InsectPhotoCard'

/* ----------------- Procedural Insect Models ----------------- */

function MothModel({ color, scale = 1.0 }) {
  return (
    <group scale={scale}>
      {/* Body: Head, Thorax, Abdomen */}
      <mesh position={[0, 0, 0]} castShadow>
        <capsuleGeometry args={[0.007, 0.024, 6, 8]} />
        <meshStandardMaterial color="#4a3728" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0, 0.016]}>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshStandardMaterial color="#2d1f14" roughness={0.7} />
      </mesh>
      {/* Left Wing (Roof-folded resting pose) */}
      <mesh position={[-0.012, 0.006, -0.002]} rotation={[0.2, -0.35, -0.45]}>
        <boxGeometry args={[0.024, 0.002, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Right Wing */}
      <mesh position={[0.012, 0.006, -0.002]} rotation={[0.2, 0.35, 0.45]}>
        <boxGeometry args={[0.024, 0.002, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Antennae */}
      <mesh position={[-0.006, 0.006, 0.022]} rotation={[0.4, -0.5, 0]}>
        <cylinderGeometry args={[0.0006, 0.0006, 0.018]} />
        <meshBasicMaterial color="#1a110a" />
      </mesh>
      <mesh position={[0.006, 0.006, 0.022]} rotation={[0.4, 0.5, 0]}>
        <cylinderGeometry args={[0.0006, 0.0006, 0.018]} />
        <meshBasicMaterial color="#1a110a" />
      </mesh>
    </group>
  )
}

function LocustModel({ color, scale = 1.0 }) {
  return (
    <group scale={scale}>
      {/* Elongated segmented body */}
      <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.007, 0.005, 0.05, 8]} />
        <meshStandardMaterial color="#556b2f" roughness={0.7} />
      </mesh>
      {/* Pronotum / Head shield */}
      <mesh position={[0, 0.008, 0.016]}>
        <boxGeometry args={[0.013, 0.014, 0.016]} />
        <meshStandardMaterial color="#6b8e23" roughness={0.6} />
      </mesh>
      {/* Large Hind Leg Left */}
      <group position={[-0.009, 0.01, -0.01]} rotation={[-0.6, -0.2, 0.4]}>
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.003, 0.0015, 0.032]} />
          <meshStandardMaterial color="#4a5d23" />
        </mesh>
      </group>
      {/* Large Hind Leg Right */}
      <group position={[0.009, 0.01, -0.01]} rotation={[-0.6, 0.2, -0.4]}>
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.003, 0.0015, 0.032]} />
          <meshStandardMaterial color="#4a5d23" />
        </mesh>
      </group>
      {/* Narrow folded wings on back */}
      <mesh position={[0, 0.012, -0.006]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.011, 0.002, 0.048]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ----------------- Single Animated Live Insect Track ----------------- */

function SingleLiveInsect({
  detection,
  hostUrl,
  staggerOffset = 0,
  onFlyTo,
}) {
  const groupRef = useRef()
  const targetPos = useRef(new THREE.Vector3(detection.bed.x, detection.targetY, detection.bed.z))
  const currentPos = useRef(targetPos.current.clone())
  const [opacity, setOpacity] = useState(1.0)

  // Update target when detection coordinates change
  useEffect(() => {
    if (detection.bed) {
      targetPos.current.set(detection.bed.x, detection.targetY, detection.bed.z)
    }
  }, [detection.bed?.x, detection.bed?.z, detection.targetY])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Smooth position interpolation (lerp)
    currentPos.current.lerp(targetPos.current, Math.min(1.0, delta * 8.0))
    groupRef.current.position.copy(currentPos.current)

    // Handle smooth fade out after track disappears
    const ageSinceActive = Date.now() - detection.lastSeenTime
    if (ageSinceActive > 0) {
      const remainingFraction = Math.max(0, 1.0 - ageSinceActive / 1500)
      setOpacity(remainingFraction)
    } else {
      setOpacity(1.0)
    }
  })

  const isLocust = detection.label === 'locust'
  const color = getSpeciesColor(detection.label)
  const posArray = [detection.bed.x, detection.targetY, detection.bed.z]

  const handleClick = () => {
    if (onFlyTo) {
      onFlyTo(detection.bed.x, detection.targetY, detection.bed.z)
    }
  }

  if (opacity <= 0.01) return null

  return (
    <group ref={groupRef} position={posArray}>
      <group onClick={handleClick} style={{ cursor: 'pointer' }}>
        {/* Procedural 3D model (3x real size for clear visibility) */}
        {isLocust ? (
          <LocustModel color={color} scale={3.0} />
        ) : (
          <MothModel color={color} scale={3.0} />
        )}

        {/* Small ground shadow indicator on soil */}
        <mesh position={[0, SOIL_TOP - detection.targetY + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35 * opacity} />
        </mesh>
      </group>

      {/* Floating photo card with camera crop */}
      <InsectPhotoCard
        detection={detection}
        hostUrl={hostUrl}
        position={[0, 0, 0]}
        staggerOffset={staggerOffset}
        onClick={handleClick}
      />
    </group>
  )
}

/* ----------------- Live Insects Manager ----------------- */

export default function LiveInsects({ hostState, onFlyTo }) {
  const { connected, hostUrl, state } = hostState
  const activeTracks = useRef(new Map())
  const [, setTick] = useState(0)

  // Ingest detections from 10Hz WebSocket
  useEffect(() => {
    if (!connected || !state.detections) return

    const now = Date.now()
    const currentIds = new Set()

    for (const det of state.detections) {
      if (!det.bed) continue
      currentIds.add(det.id)

      // Canopy level for moths: SOIL_TOP + 0.40m, surface level for crawling insects
      const isMoth = det.label.includes('moth')
      const targetY = SOIL_TOP + (isMoth ? 0.40 : 0.08)

      activeTracks.current.set(det.id, {
        ...det,
        targetY,
        lastSeenTime: now,
      })
    }

    // Prune tracks older than 1.5s
    for (const [tid, item] of activeTracks.current.entries()) {
      if (!currentIds.has(tid)) {
        if (now - item.lastSeenTime > 1500) {
          activeTracks.current.delete(tid)
        }
      }
    }

    setTick((t) => t + 1)
  }, [connected, state.detections])

  // Compute card anti-overlap staggers (offset cards when distance < 15cm)
  const tracksList = Array.from(activeTracks.current.values())
  const staggers = useMemo(() => {
    const offsets = {}
    for (let i = 0; i < tracksList.length; i++) {
      const a = tracksList[i]
      offsets[a.id] = 0
      for (let j = 0; j < i; j++) {
        const b = tracksList[j]
        const dx = a.bed.x - b.bed.x
        const dz = a.bed.z - b.bed.z
        const dist = Math.hypot(dx, dz)
        if (dist < 0.15) {
          offsets[a.id] = 0.14  // Elevate card by 14cm
          break
        }
      }
    }
    return offsets
  }, [tracksList])

  if (!connected) return null

  return (
    <group name="live-insects">
      {tracksList.map((track) => (
        <SingleLiveInsect
          key={track.id}
          detection={track}
          hostUrl={hostUrl}
          staggerOffset={staggers[track.id] || 0}
          onFlyTo={onFlyTo}
        />
      ))}
    </group>
  )
}
