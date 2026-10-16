import { EXPERIMENT } from '../experimentConfig'

/** Which zone (if any) contains world point (x, z). */
export function zoneOf(x, z, zones = EXPERIMENT.zones) {
  return zones.find((zn) => x >= zn.rect.x0 && x < zn.rect.x1 && z >= zn.rect.z0 && z < zn.rect.z1) ?? null
}

/**
 * Count detections per zone.
 * @param detections  [{ x, z }] in world metres (e.g. projected from camera-space detections)
 * @returns { A: n, B: n, outside: n }
 */
export function countByZone(detections, zones = EXPERIMENT.zones) {
  const out = Object.fromEntries(zones.map((z) => [z.id, 0]))
  out.outside = 0
  for (const d of detections) {
    const zn = zoneOf(d.x, d.z, zones)
    if (zn) out[zn.id] += 1
    else out.outside += 1
  }
  return out
}

/** Zone area in m² — normalise counts to density when zones differ in size. */
export const zoneArea = (zone) => (zone.rect.x1 - zone.rect.x0) * (zone.rect.z1 - zone.rect.z0)
