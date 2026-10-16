import * as THREE from 'three'
import { mulberry32 } from './random'

/**
 * Procedural textures drawn on canvases at start-up — no image files needed.
 * The reference photo is never used as a texture; these are generic material maps.
 */

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function toTexture(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.needsUpdate = true
  return t
}

const cache = new Map()
const memo = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn())
  return cache.get(key)
}

/**
 * Kraft corrugated board, outer liner.
 * One tile = 1 m wide × full wall height, so the fold crease and the soil
 * staining at the bottom land at the right physical height.
 */
export function cardboardMaps(side = 'outer') {
  return memo('cardboard-' + side, () => {
    const W = 1024
    const H = 320
    const rand = mulberry32(side === 'outer' ? 11 : 23)
    const [c, g] = canvas(W, H)
    const [bc, b] = canvas(W, H)

    // base kraft colour
    g.fillStyle = side === 'outer' ? '#bf9563' : '#b88c5a'
    g.fillRect(0, 0, W, H)
    b.fillStyle = '#808080'
    b.fillRect(0, 0, W, H)

    // broad tonal mottling
    for (let i = 0; i < 90; i++) {
      const x = rand() * W
      const y = rand() * H
      const r = 40 + rand() * 160
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      const dark = rand() < 0.5
      grd.addColorStop(0, dark ? 'rgba(120,80,40,0.07)' : 'rgba(230,200,150,0.07)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // corrugation flutes showing faintly through the liner (vertical, ~8 mm pitch)
    const pitch = W / 125
    for (let x = 0; x < W; x += pitch) {
      g.fillStyle = 'rgba(90,60,30,0.05)'
      g.fillRect(x, 0, pitch * 0.45, H)
      g.fillStyle = 'rgba(255,235,200,0.035)'
      g.fillRect(x + pitch * 0.5, 0, pitch * 0.4, H)
      b.fillStyle = 'rgba(0,0,0,0.10)'
      b.fillRect(x, 0, pitch * 0.45, H)
      b.fillStyle = 'rgba(255,255,255,0.08)'
      b.fillRect(x + pitch * 0.5, 0, pitch * 0.4, H)
    }

    // paper fibres
    for (let i = 0; i < 9000; i++) {
      const x = rand() * W
      const y = rand() * H
      const len = 2 + rand() * 7
      const a = rand() * Math.PI
      g.strokeStyle = rand() < 0.5 ? 'rgba(95,62,30,0.12)' : 'rgba(240,215,170,0.10)'
      g.lineWidth = 0.6
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      g.stroke()
    }

    // fine speckle
    const img = g.getImageData(0, 0, W, H)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * 14
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    g.putImageData(img, 0, 0)

    if (side === 'outer') {
      // flap fold crease ~3.5 cm below the rim
      const cy = H * 0.12
      g.fillStyle = 'rgba(80,52,25,0.22)'
      g.fillRect(0, cy, W, 2)
      g.fillStyle = 'rgba(255,235,200,0.15)'
      g.fillRect(0, cy + 2, W, 2)
      b.fillStyle = 'rgba(0,0,0,0.6)'
      b.fillRect(0, cy, W, 3)

      // soil staining and scuffing near the floor
      const grd = g.createLinearGradient(0, H * 0.82, 0, H)
      grd.addColorStop(0, 'rgba(70,45,25,0)')
      grd.addColorStop(1, 'rgba(70,45,25,0.22)')
      g.fillStyle = grd
      g.fillRect(0, H * 0.82, W, H * 0.18)
    } else {
      // inside face: damp, darker band where the soil sits (soil top at ~83% of wall)
      const grd = g.createLinearGradient(0, H * 0.1, 0, H * 0.22)
      grd.addColorStop(0, 'rgba(60,38,20,0)')
      grd.addColorStop(1, 'rgba(60,38,20,0.35)')
      g.fillStyle = grd
      g.fillRect(0, H * 0.1, W, H * 0.9)
    }

    return { map: toTexture(c), bumpMap: toTexture(bc, { srgb: false }) }
  })
}

/** Edge-on corrugated cross-section for the top rim of the walls. */
export function fluteEdgeMap() {
  return memo('flute', () => {
    const [c, g] = canvas(512, 32)
    g.fillStyle = '#a77d4c'
    g.fillRect(0, 0, 512, 32)
    g.strokeStyle = '#d8b583'
    g.lineWidth = 2.5
    g.beginPath()
    for (let x = 0; x <= 512; x += 2) {
      const y = 16 + Math.sin((x / 512) * Math.PI * 2 * 16) * 9
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
    }
    g.stroke()
    g.fillStyle = '#d2ad7a'
    g.fillRect(0, 0, 512, 4)
    g.fillRect(0, 28, 512, 4)
    return toTexture(c, { repeat: [1, 1] })
  })
}

/** Granular soil detail (tiles every ~25 cm). */
export function soilMaps() {
  return memo('soil', () => {
    const S = 512
    const rand = mulberry32(5)
    const [c, g] = canvas(S, S)
    const [bc, b] = canvas(S, S)
    g.fillStyle = '#c4b8ac'
    g.fillRect(0, 0, S, S)
    b.fillStyle = '#7a7a7a'
    b.fillRect(0, 0, S, S)
    const draw = (ctx, x, y, r, col) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    const wrapDraw = (ctx, x, y, r, col) => {
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) draw(ctx, x + ox, y + oy, r, col)
    }
    for (let i = 0; i < 14000; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 0.6 + rand() * rand() * 4
      const l = rand()
      const col =
        l < 0.45
          ? `rgba(${70 + rand() * 40},${62 + rand() * 32},${56 + rand() * 26},0.85)`
          : l < 0.88
            ? `rgba(${200 + rand() * 40},${188 + rand() * 36},${176 + rand() * 30},0.7)`
            : `rgba(${245},${238},${228},0.6)`
      wrapDraw(g, x, y, r, col)
      const v = Math.floor(80 + (l - 0.3) * 160 + r * 12)
      wrapDraw(b, x, y, r, `rgb(${v},${v},${v})`)
    }
    return {
      map: toTexture(c, { repeat: [8, 4] }),
      bumpMap: toTexture(bc, { srgb: false, repeat: [8, 4] }),
    }
  })
}

/** Subtle polished-concrete studio floor. */
export function floorMap() {
  return memo('floor', () => {
    const S = 1024
    const rand = mulberry32(3)
    const [c, g] = canvas(S, S)
    g.fillStyle = '#bfb8ad'
    g.fillRect(0, 0, S, S)
    for (let i = 0; i < 260; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 30 + rand() * 180
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      grd.addColorStop(0, rand() < 0.5 ? 'rgba(150,142,130,0.08)' : 'rgba(225,220,212,0.08)')
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.fillRect(x - r, y - r, r * 2, r * 2)
    }
    const img = g.getImageData(0, 0, S, S)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * 8
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    g.putImageData(img, 0, 0)
    return toTexture(c, { repeat: [6, 6] })
  })
}
