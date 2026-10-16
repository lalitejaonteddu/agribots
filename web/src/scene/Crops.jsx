import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SOIL_TOP } from '../config/setup'
import { FIELD, soilHeight } from './fieldLayout'
import { buildPlant } from './plantGeometry'

const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } }

/** Adds a gentle height-weighted sway to a standard material (visual only). */
function addWind(material, flutter) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime
    shader.uniforms.uWind = windUniforms.uWind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float hgt = max(transformed.y - ${SOIL_TOP.toFixed(3)}, 0.0);
        float k = hgt * hgt * 0.012 * uWind;
        float ph = transformed.x * 2.1 + transformed.z * 3.3;
        transformed.x += k * sin(uTime * 1.1 + ph);
        transformed.z += k * 0.6 * cos(uTime * 0.9 + ph * 1.3);
        transformed.y += ${flutter.toFixed(4)} * uWind * hgt * sin(uTime * 3.7 + ph * 9.0);`,
      )
  }
  return material
}

/** Build every plant once and merge into two meshes (leaves + stalks). */
function useCropGeometry() {
  return useMemo(() => {
    const leafGeos = []
    const stemGeos = []
    const measured = []
    for (const plant of FIELD.plants) {
      const baseY = soilHeight(plant.x, plant.z)
      const { leaves, stems } = buildPlant(plant, baseY)
      let top = 0
      for (const g of leaves) {
        g.computeBoundingBox()
        top = Math.max(top, g.boundingBox.max.y)
      }
      measured.push({ id: plant.id, height: top - SOIL_TOP })
      leafGeos.push(...leaves)
      stemGeos.push(...stems)
    }
    for (const s of FIELD.seedlings) {
      leafGeos.push(...buildPlant(s, soilHeight(s.x, s.z), { seedling: true }).leaves)
    }
    const leaves = mergeGeometries(leafGeos)
    const stems = mergeGeometries(stemGeos)
    leafGeos.forEach((g) => g.dispose())
    stemGeos.forEach((g) => g.dispose())
    return { leaves, stems, measured }
  }, [])
}

export const cropStats = { measured: [] }

export default function Crops({ wind = true }) {
  const { leaves, stems, measured } = useCropGeometry()
  cropStats.measured = measured

  const leafMat = useMemo(
    () =>
      addWind(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          roughness: 0.62,
          metalness: 0,
        }),
        0.004,
      ),
    [],
  )
  const stemMat = useMemo(
    () => addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), 0),
    [],
  )

  useFrame((_, dt) => {
    windUniforms.uTime.value += dt
    windUniforms.uWind.value = THREE.MathUtils.lerp(windUniforms.uWind.value, wind ? 1 : 0, 0.05)
  })

  return (
    <group name="crops">
      <mesh geometry={leaves} material={leafMat} castShadow receiveShadow />
      <mesh geometry={stems} material={stemMat} castShadow receiveShadow />
    </group>
  )
}
