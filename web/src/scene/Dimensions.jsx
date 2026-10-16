import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { SETUP, SOIL_TOP, CORNER_PILLARS, MAST_TOP, LENS_POSITION } from '../config/setup'

const INK = '#1f3b57'
const ACCENT = '#2f6fb0'
const CROP = '#3f7d2c'

const fmt = (m) => `${m.toFixed(2)} m`

function Label({ position, children, tone = 'ink', small }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`dim-label dim-${tone}${small ? ' dim-small' : ''}`}>{children}</div>
    </Html>
  )
}

/** Dimension line with end ticks. `tick` is the tick direction (unit vector). */
function DimLine({ a, b, tick = [0, 1, 0], tickSize = 0.03, color = INK, dashed = false, width = 1.6 }) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const T = new THREE.Vector3(...tick).normalize().multiplyScalar(tickSize)
  const segs = [
    [A, B],
    [A.clone().sub(T), A.clone().add(T)],
    [B.clone().sub(T), B.clone().add(T)],
  ]
  return segs.map(([p, q], i) => (
    <Line
      key={i}
      points={[p, q]}
      color={color}
      lineWidth={i === 0 ? width : width + 0.4}
      dashed={dashed && i === 0}
      dashSize={0.03}
      gapSize={0.02}
      depthTest={false}
      transparent
      opacity={0.9}
      renderOrder={10}
    />
  ))
}

function Extension({ a, b, color = INK }) {
  return (
    <Line points={[a, b]} color={color} lineWidth={1} transparent opacity={0.45} depthTest={false} renderOrder={10} />
  )
}

export default function Dimensions({ getCropRange }) {
  const cropRange = getCropRange?.()
  const { length: L, width: W, height: H } = SETUP.planter
  const yF = 0.002
  const zFront = W / 2 + 0.14
  const xRight = L / 2 + 0.14
  const [cMin, cMax] = cropRange ?? [SETUP.crops.minHeight, SETUP.crops.maxHeight]

  return (
    <group name="dimensions">
      {/* Length */}
      <Extension a={[-L / 2, yF, W / 2]} b={[-L / 2, yF, zFront + 0.03]} />
      <Extension a={[L / 2, yF, W / 2]} b={[L / 2, yF, zFront + 0.03]} />
      <DimLine a={[-L / 2, yF, zFront]} b={[L / 2, yF, zFront]} tick={[0, 0, 1]} />
      <Label position={[0, yF + 0.02, zFront + 0.02]}>
        Length <b>{fmt(L)}</b>
      </Label>

      {/* Width */}
      <Extension a={[L / 2, yF, -W / 2]} b={[xRight + 0.03, yF, -W / 2]} />
      <Extension a={[L / 2, yF, W / 2]} b={[xRight + 0.03, yF, W / 2]} />
      <DimLine a={[xRight, yF, -W / 2]} b={[xRight, yF, W / 2]} tick={[1, 0, 0]} />
      <Label position={[xRight + 0.02, yF + 0.02, 0]}>
        Width <b>{fmt(W)}</b>
      </Label>

      {/* Box height (front-right corner) */}
      <DimLine a={[L / 2 + 0.06, 0, W / 2 + 0.06]} b={[L / 2 + 0.06, H, W / 2 + 0.06]} tick={[1, 0, -1]} />
      <Label position={[L / 2 + 0.07, H * 0.62, W / 2 + 0.07]} small>
        Box height <b>{fmt(H)}</b>
      </Label>

      {/* Soil depth (front-left corner) */}
      <DimLine
        a={[-L / 2 - 0.06, 0, W / 2 + 0.06]}
        b={[-L / 2 - 0.06, SOIL_TOP, W / 2 + 0.06]}
        tick={[1, 0, 1]}
        color="#6b4a2b"
      />
      <Line
        points={[
          [-L / 2 - 0.08, SOIL_TOP, W / 2 + 0.002],
          [-L / 2 + 0.35, SOIL_TOP, W / 2 + 0.012],
        ]}
        color="#6b4a2b"
        lineWidth={1.4}
        dashed
        dashSize={0.025}
        gapSize={0.015}
        depthTest={false}
        renderOrder={10}
      />
      <Label position={[-L / 2 - 0.07, SOIL_TOP * 0.45, W / 2 + 0.07]} tone="soil" small>
        Soil depth <b>{fmt(SETUP.soil.depth)}</b>
      </Label>

      {/* Crop height range (back-left, outside the box) */}
      <group position={[-L / 2 - 0.12, 0, -W / 2 + 0.05]}>
        <DimLine a={[0, SOIL_TOP, 0]} b={[0, SOIL_TOP + cMax, 0]} tick={[1, 0, 0]} color={CROP} />
        <DimLine
          a={[0, SOIL_TOP + cMin, 0]}
          b={[0, SOIL_TOP + cMin, 0]}
          tick={[1, 0, 0]}
          tickSize={0.05}
          color={CROP}
        />
        <mesh position={[0, SOIL_TOP + (cMin + cMax) / 2, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={9}>
          <planeGeometry args={[0.06, cMax - cMin]} />
          <meshBasicMaterial color={CROP} transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <Label position={[0, SOIL_TOP + (cMin + cMax) / 2, 0]} tone="crop">
          Crop height <b>{fmt(cMin)} – {fmt(cMax)}</b>
          <span className="dim-sub">above soil</span>
        </Label>
      </group>

      {/* Corner pillars */}
      {CORNER_PILLARS.map((p) => {
        const out = new THREE.Vector2(p.x, p.z).normalize().multiplyScalar(0.075)
        const x = p.x + out.x
        const z = p.z + out.y
        const h = SETUP.pillars.cornerHeight
        return (
          <group key={p.id}>
            <DimLine
              a={[x, SOIL_TOP, z]}
              b={[x, SOIL_TOP + h, z]}
              tick={[-out.y, 0, out.x]}
              tickSize={0.025}
              color={ACCENT}
              width={1.2}
            />
            <Label position={[x, SOIL_TOP + h * 0.86, z]} tone="accent" small>
              {p.id} pillar <b>{fmt(h)}</b>
            </Label>
          </group>
        )
      })}

      {/* Central camera mast */}
      <DimLine
        a={[SETUP.mast.position[0] + 0.09, SOIL_TOP, SETUP.mast.position[1]]}
        b={[SETUP.mast.position[0] + 0.09, MAST_TOP, SETUP.mast.position[1]]}
        tick={[0, 0, 1]}
        tickSize={0.025}
        color="#6b3fa0"
        width={1.4}
      />
      <Label position={[SETUP.mast.position[0] + 0.1, SOIL_TOP + SETUP.mast.height * 0.9, SETUP.mast.position[1]]} tone="mast">
        Camera mast <b>{fmt(SETUP.mast.height)}</b>
        <span className="dim-sub">lens {fmt(LENS_POSITION[1] - SOIL_TOP)} above soil</span>
      </Label>
    </group>
  )
}
