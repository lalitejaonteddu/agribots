import { ContactShadows, Environment, Lightformer, SoftShadows } from '@react-three/drei'
import { floorMap } from '../utils/textures'

export const BACKGROUND = '#e6e2dc'

/** Neutral studio: soft key light with shadows, fill, studio reflections and a fading floor. */
export default function Studio({ softShadows = true }) {
  const floor = floorMap()
  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, 8, 20]} />
      {softShadows && <SoftShadows size={22} samples={12} focus={0.7} />}

      <hemisphereLight args={['#ffffff', '#b5a88f', 0.75]} />
      <directionalLight
        position={[-2.6, 6, 3.4]}
        intensity={2.4}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.015}
        shadow-camera-left={-2.6}
        shadow-camera-right={2.6}
        shadow-camera-top={2.6}
        shadow-camera-bottom={-2.6}
        shadow-camera-near={1}
        shadow-camera-far={15}
      />
      <directionalLight position={[4, 3, -2.5]} intensity={0.55} color="#e8eefc" />

      <Environment resolution={256} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 8, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, 3]} rotation={[0, Math.PI / 2.5, 0]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[6, 2, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#d9cbb5" position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[10, 10, 1]} />
      </Environment>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial map={floor} roughness={0.82} metalness={0} color="#ffffff" />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} scale={[3.2, 2.2]} opacity={0.55} blur={2.2} far={0.5} frames={1} resolution={512} color="#2b2116" />
    </>
  )
}
