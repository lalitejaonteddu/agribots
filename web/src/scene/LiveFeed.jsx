import { SETUP } from '../config/setup'

/** Screen-space rectangle helper for live panel sizing */
export function feedPanelRect(viewW, viewH) {
  const margin = viewW < 700 ? 10 : 18
  const width = Math.round(Math.min(360, viewW * 0.42))
  const height = Math.round(width / SETUP.camera.aspect)
  return { margin, width, height, right: margin, bottom: margin + (viewW < 700 ? 54 : 0) }
}

/** Placeholder Three.js component retained for interface compatibility */
export default function LiveFeed() {
  return null
}
