import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { SOIL_TOP } from '../config/setup'
import { EXPERIMENT } from './experimentConfig'
import { FIELD } from '../scene/fieldLayout'
import { zoneOf } from './analysis/zoneStats'

/** Translucent overlays marking treated vs. control areas, with plant counts per zone. */
export default function TreatmentZones() {
  const counts = useMemo(() => {
    const c = {}
    for (const p of FIELD.plants) {
      const z = zoneOf(p.x, p.z)
      if (z) c[z.id] = (c[z.id] ?? 0) + 1
    }
    return c
  }, [])

  const y = SOIL_TOP + 0.045
  return (
    <group name="treatment-zones">
      {EXPERIMENT.zones.map((zn) => {
        const { x0, x1, z0, z1 } = zn.rect
        const inset = 0.01
        const pts = [
          [x0 + inset, y, z0 + inset],
          [x1 - inset, y, z0 + inset],
          [x1 - inset, y, z1 - inset],
          [x0 + inset, y, z1 - inset],
          [x0 + inset, y, z0 + inset],
        ]
        return (
          <group key={zn.id}>
            <mesh position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
              <planeGeometry args={[x1 - x0 - 2 * inset, z1 - z0 - 2 * inset]} />
              <meshBasicMaterial color={zn.color} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <Line points={pts} color={zn.color} lineWidth={2} dashed dashSize={0.04} gapSize={0.025} />
            <Html position={[(x0 + x1) / 2, SOIL_TOP + 1.85, (z0 + z1) / 2]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className="zone-tag" style={{ '--zc': zn.color }}>
                {zn.label}
                <span>{counts[zn.id] ?? 0} plants</span>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
