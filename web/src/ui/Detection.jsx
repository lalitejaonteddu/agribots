import { useState } from 'react'

export function PipelineBadge({ hostState }) {
  const { connected, state } = hostState
  const insectCount = state.detections ? state.detections.length : 0
  const isOutputOn = state.output && state.output.active
  const freq = state.output ? state.output.freq : 40000
  const sourceLabel = (state.output?.source || 'host-trigger').toUpperCase()

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '20px',
        background: isOutputOn ? 'rgba(234, 88, 12, 0.25)' : 'rgba(15, 23, 42, 0.75)',
        border: `1px solid ${isOutputOn ? '#f97316' : 'rgba(56, 189, 248, 0.3)'}`,
        backdropFilter: 'blur(8px)',
        fontSize: '11px',
        fontWeight: '600',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <span style={{ color: '#38bdf8' }}>CAMERA</span>
      <span style={{ color: '#94a3b8' }}>→</span>
      <span style={{ color: '#a855f7' }}>YOLO</span>
      <span style={{ color: '#94a3b8' }}>:</span>
      <span style={{ color: insectCount > 0 ? '#facc15' : '#94a3b8' }}>
        {insectCount} {insectCount === 1 ? 'insect' : 'insects'}
      </span>
      <span style={{ color: '#94a3b8' }}>→</span>
      <span style={{ color: isOutputOn ? '#22c55e' : '#64748b' }}>
        {sourceLabel} OUTPUT {isOutputOn ? 'ON' : 'OFF'} ({Math.round(freq / 1000)} kHz)
      </span>
    </div>
  )
}

export function DetectorCard({ hostState }) {
  const { connected, hostUrl, state, setHostUrl, setMode, setFreq } = hostState
  const [editingUrl, setEditingUrl] = useState(hostUrl)
  const [urlSaved, setUrlSaved] = useState(false)

  const currentMode = state.output?.mode || 'AUTO'
  const currentFreq = state.output?.freq || 40000
  const serialState = state.serial || 'NOT CONNECTED'
  const warnings = state.warnings || []

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    setHostUrl(editingUrl)
    setUrlSaved(true)
    setTimeout(() => setUrlSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Connection & Bridge Status */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
            LIVE HOST LINK
          </h2>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              fontWeight: '700',
              color: connected ? '#22c55e' : '#ef4444',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: connected ? '#22c55e' : '#ef4444',
                boxShadow: connected ? '0 0 8px #22c55e' : 'none',
              }}
            />
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={editingUrl}
            onChange={(e) => setEditingUrl(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              color: '#f8fafc',
            }}
            placeholder="http://localhost:8765"
          />
          <button
            type="submit"
            style={{
              background: '#0284c7',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '600',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            {urlSaved ? '✓ Saved' : 'Connect'}
          </button>
        </form>

        {!connected && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              fontSize: '10px',
              color: '#fca5a5',
              lineHeight: '1.4',
            }}
          >
            <strong>Host not running.</strong> Start the perception engine:
            <code style={{ display: 'block', marginTop: '4px', background: '#020617', padding: '4px', borderRadius: '4px' }}>
              python host/main.py --builtin --web
            </code>
          </div>
        )}
      </section>

      {/* Warnings & Alerts Banner */}
      {warnings.length > 0 && (
        <section
          style={{
            padding: '8px 10px',
            background: 'rgba(245, 158, 11, 0.18)',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            fontSize: '10px',
            color: '#fde68a',
          }}
        >
          {warnings.map((w, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span>
              <span>{w}</span>
            </div>
          ))}
        </section>
      )}

      {/* Live System Diagnostics */}
      <section>
        <h2 style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '8px' }}>
          SYSTEM DIAGNOSTICS
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Camera:</span>
            <span style={{ fontWeight: '600', color: '#f8fafc' }}>{state.camera}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Loop Rate:</span>
            <span style={{ fontWeight: '600', color: '#38bdf8' }}>{state.fps.toFixed(1)} FPS</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Serial Link:</span>
            <span
              style={{
                fontWeight: '700',
                color:
                  serialState === 'CONNECTED'
                    ? '#22c55e'
                    : serialState === 'FAILSAFE'
                      ? '#ef4444'
                      : '#f59e0b',
              }}
            >
              {serialState}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Detections:</span>
            <span style={{ fontWeight: '700', color: '#facc15' }}>
              {state.detections ? state.detections.length : 0} active
            </span>
          </div>
        </div>
      </section>

      {/* Real Deterrence Controls */}
      <section>
        <h2 style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '8px' }}>
          ACTUATION CONTROLS
        </h2>

        {/* Mode Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
          <button
            onClick={() => setMode('AUTO')}
            style={{
              padding: '6px 4px',
              borderRadius: '4px',
              border: `1px solid ${currentMode === 'AUTO' ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)'}`,
              background: currentMode === 'AUTO' ? '#0369a1' : 'rgba(15, 23, 42, 0.6)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            AUTO
          </button>
          <button
            onClick={() => setMode('ON')}
            style={{
              padding: '6px 4px',
              borderRadius: '4px',
              border: `1px solid ${currentMode === 'ON' ? '#22c55e' : 'rgba(255, 255, 255, 0.15)'}`,
              background: currentMode === 'ON' ? '#15803d' : 'rgba(15, 23, 42, 0.6)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            FORCE ON
          </button>
          <button
            onClick={() => setMode('OFF')}
            style={{
              padding: '6px 4px',
              borderRadius: '4px',
              border: `1px solid ${currentMode === 'OFF' ? '#ef4444' : 'rgba(255, 255, 255, 0.15)'}`,
              background: currentMode === 'OFF' ? '#b91c1c' : 'rgba(15, 23, 42, 0.6)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            FORCE OFF
          </button>
        </div>

        {/* Frequency Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Frequency:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setFreq(Math.max(1000, currentFreq - 500))}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: '#1e293b',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <span style={{ fontWeight: '700', color: '#38bdf8', fontSize: '11px', minWidth: '60px', textAlign: 'center' }}>
              {currentFreq} Hz
            </span>
            <button
              onClick={() => setFreq(Math.min(50000, currentFreq + 500))}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: '#1e293b',
                color: '#fff',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
