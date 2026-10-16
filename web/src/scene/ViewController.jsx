import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Orbit-camera presets. Positions/targets in metres. */
export const VIEW_PRESETS = {
  // elevated three-quarter view from the front-left, as in the reference photo
  reset: { position: [-2.35, 2.55, 4.2], target: [0.15, 0.82, -0.05] },
  top: { position: [0, 6.4, 0.0015], target: [0, 0.25, 0] },
  side: { position: [0, 1.2, 4.9], target: [0, 1.12, 0] },
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Smoothly moves the orbit camera + controls target to a preset or insect target whenever `request` changes.
 */
export default function ViewController({ camera, request }) {
  const controls = useThree((s) => s.controls)
  const size = useThree((s) => s.size)
  const anim = useRef(null)

  useEffect(() => {
    if (!controls) return

    // Custom insect focus request
    if (request?.targetPos) {
      const [tx, ty, tz] = request.targetPos
      const to = {
        p: new THREE.Vector3(tx - 0.45, ty + 0.55, tz + 0.65),
        t: new THREE.Vector3(tx, ty, tz),
      }
      anim.current = {
        from: { p: camera.position.clone(), t: controls.target.clone() },
        to,
        start: performance.now(),
        duration: 900,
      }
      const cancel = () => (anim.current = null)
      controls.addEventListener('start', cancel)
      return () => controls.removeEventListener('start', cancel)
    }

    const preset = VIEW_PRESETS[request?.name]
    if (!preset) return
    const first = request.nonce === 0
    const to = { p: new THREE.Vector3(...preset.position), t: new THREE.Vector3(...preset.target) }
    // portrait / narrow screens: back the camera off so the whole rig still fits
    const aspect = size.width / size.height
    if (aspect < 1.3) {
      const k = Math.min(2.6, Math.pow(1.3 / aspect, 0.9))
      to.p.sub(to.t).multiplyScalar(k).add(to.t)
    }
    if (first) {
      camera.position.copy(to.p)
      controls.target.copy(to.t)
      controls.update()
      return
    }
    anim.current = {
      from: { p: camera.position.clone(), t: controls.target.clone() },
      to,
      start: performance.now(),
      duration: 900,
    }
    const cancel = () => (anim.current = null)
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [request, controls, camera, size])

  useFrame(() => {
    const a = anim.current
    if (!a || !controls) return
    const k = Math.min(1, (performance.now() - a.start) / a.duration)
    const e = ease(k)
    camera.position.lerpVectors(a.from.p, a.to.p, e)
    controls.target.lerpVectors(a.from.t, a.to.t, e)
    controls.update()
    if (k >= 1) anim.current = null
  })

  return null
}
