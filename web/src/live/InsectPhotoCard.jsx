import { useMemo } from 'react'
import { Html } from '@react-three/drei'

export const SPECIES_COLORS = {
  fall_armyworm_moth: '#ff7733',
  spodoptera_litura_moth: '#ffaa00',
  spodoptera_exigua_moth: '#00ccaa',
  locust: '#44cc44',
  default: '#38bdf8',
}

export function getSpeciesColor(label) {
  return SPECIES_COLORS[label] || SPECIES_COLORS.default
}

export default function InsectPhotoCard({
  detection,
  hostUrl,
  position,
  staggerOffset = 0,
  onClick,
}) {
  const { id, label, conf, crop } = detection
  const color = getSpeciesColor(label)
  const fullCropUrl = `${hostUrl}${crop}`

  // Card elevation above insect: 0.28m base + stagger offset
  const cardY = position[1] + 0.28 + staggerOffset

  return (
    <group position={[position[0], cardY, position[2]]}>
      {/* Visual stem line from card down to insect */}
      <mesh position={[0, -(0.14 + staggerOffset / 2), 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.28 + staggerOffset, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      <Html
        center
        distanceFactor={6}
        style={{
          pointerEvents: 'auto',
          userSelect: 'none',
          cursor: 'pointer',
        }}
      >
        <div
          onClick={onClick}
          style={{
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            border: `1.5px solid ${color}`,
            borderRadius: '6px',
            padding: '4px',
            width: '124px',
            boxShadow: `0 4px 16px rgba(0, 0, 0, 0.5), 0 0 8px ${color}44`,
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '10px',
            transform: 'translate3d(0, 0, 0)',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
        >
          {/* Real camera crop image */}
          <div
            style={{
              width: '100%',
              height: '80px',
              borderRadius: '4px',
              overflow: 'hidden',
              background: '#020617',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={fullCropUrl}
              alt={label}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          </div>

          {/* Details footer */}
          <div style={{ marginTop: '4px', lineHeight: '1.2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', color: color, textTransform: 'capitalize' }}>
                {label.replace(/_/g, ' ')}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '9px' }}>#{id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span style={{ color: '#cbd5e1' }}>Conf:</span>
              <span style={{ fontWeight: '600', color: '#38bdf8' }}>{Math.round(conf * 100)}%</span>
            </div>
          </div>
        </div>
      </Html>
    </group>
  )
}
