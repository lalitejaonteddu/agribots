import { Suspense, useCallback, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './scene/Scene'
import { SETUP } from './config/setup'
import { useHostState } from './live/hostLink'
import LiveCameraPanel from './live/LiveCameraPanel'
import DetectionGallery from './live/DetectionGallery'
import { DetectorCard, PipelineBadge } from './ui/Detection'

const VIEWS = [
  { id: 'reset', label: 'Reset view', key: '1' },
  { id: 'top', label: 'Top', key: '2' },
  { id: 'side', label: 'Side', key: '3' },
  { id: 'camera', label: 'Camera', key: '4' },
]

const TOGGLES = [
  { id: 'dimensions', label: 'Dimensions', key: 'D' },
  { id: 'livePanel', label: 'Live camera panel', key: 'L' },
  { id: 'speakers', label: 'Speaker modules' },
  { id: 'wind', label: 'Gentle wind' },
  { id: 'softShadows', label: 'Soft shadows' },
  { id: 'zones', label: 'Treated / control zones', key: 'Z' },
]

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden />
      <span className="switch-label">{label}</span>
      {hint && <kbd>{hint}</kbd>}
    </label>
  )
}

export default function App() {
  const hostState = useHostState()
  const { connected, state, setMode, setFreq } = hostState

  const [ui, setUi] = useState({
    view: 'reset',
    emission: 'shield',
    dimensions: true,
    livePanel: true,
    speakers: true,
    wind: true,
    softShadows: true,
    zones: false,
    speakerOverlay: false,
  })

  const [viewRequest, setViewRequest] = useState({ name: 'reset', nonce: 0 })
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 900)

  const setView = useCallback((id) => {
    setUi((u) => ({ ...u, view: id }))
    if (id !== 'camera') setViewRequest((r) => ({ name: id, nonce: r.nonce + 1 }))
  }, [])

  const toggle = useCallback((id, v) => setUi((u) => ({ ...u, [id]: v ?? !u[id] })), [])

  const handleFlyTo = useCallback((x, y, z) => {
    setViewRequest((r) => ({
      targetPos: [x, y, z],
      nonce: r.nonce + 1,
    }))
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return
      const v = VIEWS.find((x) => x.key === e.key)
      if (v) return setView(v.id)
      const k = e.key.toUpperCase()
      if (k === 'D') toggle('dimensions')
      if (k === 'L') toggle('livePanel')
      if (k === 'Z') toggle('zones')
      if (k === 'A') setMode('AUTO')
      if (k === 'O') setMode('ON')
      if (k === 'F') setMode('OFF')
      if (k === '+' || k === '=') setFreq(Math.min(50000, (state.output?.freq || 40000) + 500))
      if (k === '-' || k === '_') setFreq(Math.max(1000, (state.output?.freq || 40000) - 500))
      if (e.key === 'Escape' && ui.view === 'camera') setView('reset')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setView, toggle, setMode, setFreq, state.output?.freq, ui.view])

  const cameraView = ui.view === 'camera'

  return (
    <div className="app">
      <Canvas
        className="viewport"
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 38, near: 0.02, far: 60, position: [-2.35, 2.55, 4.2] }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
          camera.layers.enable(1) // annotations
          camera.layers.enable(2) // output effects
        }}
      >
        <Suspense fallback={null}>
          <Scene
            ui={ui}
            viewRequest={viewRequest}
            hostState={hostState}
            onFlyTo={handleFlyTo}
          />
        </Suspense>
      </Canvas>

      {/* ---------- Header bar with Real Pipeline Status ---------- */}
      <header className="brand">
        <div className="brand-mark" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div>
          <h1>Crop Bed 3D Live Mirror</h1>
          <p>
            {SETUP.planter.length.toFixed(1)} × {SETUP.planter.width.toFixed(1)} m Planter · Real YOLO Perception Engine
          </p>
        </div>
      </header>

      {/* Pipeline Status Chip */}
      <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
        <PipelineBadge hostState={hostState} />
      </div>

      {/* Disconnected Notification Banner */}
      {!connected && (
        <div
          style={{
            position: 'fixed',
            top: '56px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239, 68, 68, 0.92)',
            color: '#fff',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '600',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span>
          <span>Host not running — start: <code>python host/main.py --builtin --web</code></span>
        </div>
      )}

      {/* ---------- Navigation presets bar ---------- */}
      <nav className="viewbar" aria-label="Views">
        {VIEWS.map((v) => (
          <button key={v.id} className={ui.view === v.id ? 'active' : ''} onClick={() => setView(v.id)}>
            {v.label}
            <kbd>{v.key}</kbd>
          </button>
        ))}
      </nav>

      {/* ---------- Left Control Sidebar ---------- */}
      <aside className={`panel ${panelOpen ? 'open' : ''}`}>
        <button className="panel-toggle" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
          {panelOpen ? 'Hide controls' : 'Controls'}
        </button>
        {panelOpen && (
          <div className="panel-body">
            <DetectorCard hostState={hostState} />

            <section>
              <h2>Display Options</h2>
              {TOGGLES.map((t) => (
                <Switch key={t.id} checked={ui[t.id]} onChange={(v) => toggle(t.id, v)} label={t.label} hint={t.key} />
              ))}
            </section>

            <section className="help">
              <h2>Controls & Navigation</h2>
              <p>Drag to orbit · right-drag to pan · scroll to zoom.</p>
              <p>Hotkeys: [A] Auto | [O] Force On | [F] Force Off | [+/-] Frequency</p>
            </section>
          </div>
        )}
      </aside>

      {/* ---------- Live Camera Panel (Bottom-Left) ---------- */}
      <LiveCameraPanel hostState={hostState} show={ui.livePanel && !cameraView} />

      {/* ---------- Real Detection Photo Gallery (Right Sidebar) ---------- */}
      <DetectionGallery hostState={hostState} onFlyTo={handleFlyTo} />

      {/* ---------- Camera View HUD ---------- */}
      {cameraView && (
        <div className="cam-hud">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
          <div className="crosshair big" />
          <div className="cam-hud-top">
            <span className="rec" /> CAM-01 OVERHEAD STREAM · REAL YOLO INSECT DETECTIONS
          </div>
          <button className="cam-exit" onClick={() => setView('reset')}>
            Exit camera view <kbd>Esc</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
