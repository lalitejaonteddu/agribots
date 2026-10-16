import { useLayoutEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Studio from './Studio'
import Planter from './Planter'
import Soil from './Soil'
import Crops, { cropStats } from './Crops'
import Rig, { MastViewCamera } from './Rig'
import Dimensions from './Dimensions'
import ViewController from './ViewController'
import SpeakerEmitters from '../experiment/SpeakerEmitters'
import TreatmentZones from '../experiment/TreatmentZones'
import Emitters from '../experiment/Emitters'
import LiveInsects from '../live/LiveInsects'

/** Layer 1 holds annotations: visible to the orbit camera, never to the mast camera. */
export const ANNOTATION_LAYER = 1

/** Layer 2 holds output effects (shield / waves / light) */
export const EFFECTS_LAYER = 2

function OnLayer({ layer, children }) {
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current?.traverse((o) => o.layers.set(layer))
  })
  return <group ref={ref}>{children}</group>
}

const Annotations = ({ children }) => <OnLayer layer={ANNOTATION_LAYER}>{children}</OnLayer>

function cropRange() {
  const hs = cropStats.measured.map((m) => m.height)
  if (!hs.length) return undefined
  const r = (v) => Math.round(v * 20) / 20 // nearest 5 cm
  return [r(Math.min(...hs)), r(Math.max(...hs))]
}

export default function Scene({ ui, viewRequest, hostState, onFlyTo }) {
  const get = useThree((s) => s.get)
  if (import.meta.env.DEV) window.__r3f = get
  const [orbitCamera] = useState(() => get().camera)
  const cameraView = ui.view === 'camera'

  const isRealOutputActive = hostState?.state?.output?.active ?? false
  const emitterMode = isRealOutputActive ? (ui.emission || 'shield') : 'off'

  return (
    <>
      <Studio softShadows={ui.softShadows} />

      <group name="testbed">
        <Planter />
        <Soil />
        <Crops wind={ui.wind} />
        <Rig showSpeakers={ui.speakers} />
      </group>

      {/* Real Live Detected 3D Insects & Floating Photo Cards */}
      <LiveInsects hostState={hostState} onFlyTo={onFlyTo} />

      {/* Real Acoustic Shield & Speaker effects: only active when real hardware output is ON */}
      <OnLayer layer={EFFECTS_LAYER}>
        {ui.speakers && <Emitters mode={emitterMode} />}
      </OnLayer>

      <Annotations>
        {ui.dimensions && !cameraView && <Dimensions getCropRange={cropRange} />}
        {ui.zones && <TreatmentZones />}
        {ui.speakers && ui.speakerOverlay && !cameraView && <SpeakerEmitters demoActive={isRealOutputActive} />}
      </Annotations>

      <MastViewCamera active={cameraView} />

      <OrbitControls
        makeDefault
        camera={orbitCamera}
        enabled={!cameraView}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.35}
        maxDistance={11}
        maxPolarAngle={Math.PI / 2 - 0.03}
        screenSpacePanning
      />
      <ViewController camera={orbitCamera} request={viewRequest} />
    </>
  )
}
