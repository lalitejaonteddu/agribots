import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { SETUP, SOIL_TOP, CORNER_PILLARS } from '../config/setup'
import { EXPERIMENT } from './experimentConfig'
import { speakerPose } from './SpeakerEmitters'

/**
 * Visual emission effects projected from each corner pillar into the bed.
 *   mode: 'off' | 'shield' | 'waves' | 'light'
 *
 * These are illustrations of WHERE each pillar is aimed and what it is meant to emit.
 * The waves are not an acoustic simulation and the shield/light effects do not model
 * any biological response.
 */
export const EMISSION_MODES = [
  { id: 'off', label: 'Off' },
  { id: 'shield', label: 'Shield' },
  { id: 'waves', label: 'Waves' },
  { id: 'light', label: 'Light' },
]

const UP = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)

/* ---------------- sound waves ---------------- */

const waveMaterial = (color) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
      void main() {
        float body = 0.16 * smoothstep(0.0, 0.6, vUv.y);              // faint wavefront shell
        float ring = smoothstep(0.0, 0.07, vUv.y) * (1.0 - smoothstep(0.07, 0.2, vUv.y)); // bright leading edge
        float band = 0.7 + 0.3 * sin(vUv.x * 6.2831 * 12.0);
        gl_FragColor = vec4(uColor * (0.9 + 0.3 * band), uOpacity * (body + ring * band));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

function Waves({ position, axis, color, phase }) {
  const N = 6
  const shells = useRef([])
  // spherical cap around +Z, ~32° half-angle
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 40, 10, 0, Math.PI * 2, 0, 0.56)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const materials = useMemo(() => Array.from({ length: N }, () => waveMaterial(color)), [color])
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, axis), [axis])
  useFrame(({ clock }) => {
    shells.current.forEach((m, i) => {
      if (!m) return
      const t = (clock.elapsedTime * 0.45 + phase + i / N) % 1
      const r = 0.05 + t * 1.25
      m.scale.setScalar(r)
      materials[i].uniforms.uOpacity.value = Math.pow(1 - t, 1.3) * Math.min(1, t * 8) * 0.9
    })
  })
  return (
    <group position={position} quaternion={quat}>
      {materials.map((mat, i) => (
        <mesh key={i} ref={(el) => (shells.current[i] = el)} geometry={geometry} material={mat} renderOrder={7} />
      ))}
    </group>
  )
}

/* ---------------- light beam ---------------- */

const beamMaterial = (color) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() {
        vAlong = uv.y;                       // 1 at the apex (emitter), 0 at the far end
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity;
      varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); // soft volumetric edges
        float fall = pow(vAlong, 1.4);
        gl_FragColor = vec4(uColor, 0.32 * edge * fall * uIntensity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

function LightBeam({ position, axis, color, phase }) {
  const length = 1.45
  const radius = 0.42
  const mat = useMemo(() => beamMaterial(color), [color])
  const spot = useRef()
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().negate()), [axis])
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.copy(position).addScaledVector(axis, 2)
    return o
  }, [position, axis])
  const geometry = useMemo(() => {
    // apex at +Y/2 → move apex to origin, cone opening along -Y (then rotated onto the axis)
    const g = new THREE.ConeGeometry(radius, length, 40, 1, true)
    g.translate(0, -length / 2, 0)
    return g
  }, [])
  useFrame(({ clock }) => {
    const pulse = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 2.2 + phase * 6)
    mat.uniforms.uIntensity.value = pulse
    if (spot.current) spot.current.intensity = 9 * pulse
  })
  return (
    <>
      <mesh position={position} quaternion={quat} geometry={geometry} material={mat} renderOrder={7} />
      {/* glowing lens */}
      <Billboard position={position}>
        <mesh renderOrder={8}>
          <circleGeometry args={[0.035, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </Billboard>
      <primitive object={target} />
      <spotLight
        ref={spot}
        position={position}
        target={target}
        color={color}
        angle={0.36}
        penumbra={0.7}
        distance={4}
        decay={1.6}
      />
    </>
  )
}

/* ---------------- acoustic shield ---------------- */

const shieldMaterial = (color, emitters) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 0 },
      uE: { value: emitters },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN; varying vec3 vView; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vView = cameraPosition - w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity; uniform vec3 uE[4];
      varying vec3 vW; varying vec3 vN; varying vec3 vView; varying vec2 vUv;

      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.02; a *= 0.5; } return s; }

      void main() {
        // slow drifting turbulence — the "blurry, noisy" body of the field
        float n  = fbm(vW * 2.2 + vec3(0.0, -uTime * 0.35, uTime * 0.2));
        float n2 = fbm(vW * 6.5 + vec3(uTime * 0.5, uTime * 0.3, 0.0));

        // spherical sound waves from the four pillar emitters, warped by the noise
        float w = 0.0;
        for (int i = 0; i < 4; i++) {
          float d = distance(vW, uE[i]) + (n - 0.5) * 0.45;
          w += 0.5 + 0.5 * sin(d * 13.0 - uTime * 3.2 + float(i) * 1.7);
        }
        w = pow(w / 4.0, 1.5);

        // bright seams on every edge of the cuboid
        float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edge = 1.0 - smoothstep(0.0, 0.035, e);
        float edgePulse = 0.6 + 0.4 * sin(uTime * 2.4 + (vW.x + vW.y + vW.z) * 5.0);

        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
        float ground = smoothstep(0.0, 0.18, vW.y);

        // grainy shimmer so the field reads as noisy rather than glassy
        float grain = vnoise(vW * 40.0 + uTime * 6.0);
        float band = smoothstep(0.25, 0.85, w);
        float a = 0.025 + 0.42 * band * (0.35 + n) + 0.10 * n2 * n + 0.06 * grain * band + 0.18 * fres + 0.55 * edge * edgePulse;
        vec3 col = mix(uColor * 0.75, vec3(0.75, 0.93, 1.0), clamp(band * n2 * 1.4 + edge * 0.5, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.85) * ground * uIntensity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

/**
 * Translucent cuboid spanning the four corner pillars, floor to pillar tops,
 * with noisy wavefronts rippling across all five faces (4 walls + roof).
 */
function Shield({ color }) {
  const xs = CORNER_PILLARS.map((p) => p.x)
  const zs = CORNER_PILLARS.map((p) => p.z)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const z0 = Math.min(...zs), z1 = Math.max(...zs)
  const top = SOIL_TOP + SETUP.pillars.cornerHeight
  const W = x1 - x0
  const D = z1 - z0
  const emitters = useMemo(() => EXPERIMENT.speakers.map((s) => speakerPose(s.pillar).position), [])
  const mat = useMemo(() => shieldMaterial(color, emitters), [color, emitters])
  useFrame(({ clock }, dt) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uIntensity.value = Math.min(1, mat.uniforms.uIntensity.value + dt * 1.5) // fade in
  })
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const faces = [
    { pos: [cx, top / 2, z1], rot: [0, 0, 0], size: [W, top] }, // front
    { pos: [cx, top / 2, z0], rot: [0, Math.PI, 0], size: [W, top] }, // back
    { pos: [x1, top / 2, cz], rot: [0, Math.PI / 2, 0], size: [D, top] }, // right
    { pos: [x0, top / 2, cz], rot: [0, -Math.PI / 2, 0], size: [D, top] }, // left
    { pos: [cx, top, cz], rot: [-Math.PI / 2, 0, 0], size: [W, D] }, // roof
  ]
  return (
    <group name="acoustic-shield">
      {faces.map((f, i) => (
        <mesh key={i} position={f.pos} rotation={f.rot} material={mat} renderOrder={6}>
          <planeGeometry args={f.size} />
        </mesh>
      ))}
      {/* glowing emitter heads */}
      {emitters.map((p, i) => (
        <Billboard key={i} position={p}>
          <mesh renderOrder={9} scale={0.16}>
            <planeGeometry />
            <meshBasicMaterial map={glowTexture()} color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </Billboard>
      ))}
    </group>
  )
}

const glowTexture = (() => {
  let tex
  return () => {
    if (tex) return tex
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 64, 64)
    tex = new THREE.CanvasTexture(c)
    return tex
  }
})()

/* ---------------- all pillars ---------------- */

const COLORS = { shield: '#1b86d6', waves: '#46c8ff', light: '#ffd98a' }

export default function Emitters({ mode }) {
  if (mode === 'off') return null
  if (mode === 'shield') return <Shield color={COLORS.shield} />
  return (
    <group name={`emitters-${mode}`}>
      {EXPERIMENT.speakers.map((s, i) => {
        const { position, axis } = speakerPose(s.pillar)
        const props = { position, axis, color: COLORS[mode], phase: i * 0.21, index: i }
        if (mode === 'waves') return <Waves key={s.id} {...props} />
        return <LightBeam key={s.id} {...props} />
      })}
    </group>
  )
}
