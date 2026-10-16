import { useState } from 'react'

export default function LiveCameraPanel({ hostState, show = true }) {
  const { connected, hostUrl, state } = hostState
  const [minimized, setMinimized] = useState(false)
  const streamUrl = `${hostUrl}/stream.mjpg?boxes=1`

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: '20px',
        bottom: '20px',
        width: minimized ? '180px' : '320px',
        background: 'rgba(15, 23, 42, 0.90)',
        backdropFilter: 'blur(12px)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
        zIndex: 40,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(30, 41, 59, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '11px',
          fontWeight: '700',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? '#ef4444' : '#64748b',
              boxShadow: connected ? '0 0 6px #ef4444' : 'none',
              animation: connected ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          <span>LIVE CAM-01 ({state.camera || 'Webcam'})</span>
        </div>
        <button
          onClick={() => setMinimized(!minimized)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: '11px',
          }}
        >
          {minimized ? '▢' : '—'}
        </button>
      </div>

      {/* Video Stream Container */}
      {!minimized && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '180px',
            background: '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {connected ? (
            <img
              src={streamUrl}
              alt="Live Camera Feed with YOLO Bounding Boxes"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                color: '#64748b',
                fontSize: '11px',
              }}
            >
              <div>Camera offline</div>
              <div style={{ fontSize: '10px', marginTop: '4px' }}>Start host: python host/main.py --web</div>
            </div>
          )}

          {/* Stream Overlay info */}
          {connected && (
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                left: '6px',
                right: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 6px',
                background: 'rgba(0, 0, 0, 0.65)',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: '600',
              }}
            >
              <span style={{ color: '#38bdf8' }}>{state.fps.toFixed(1)} FPS</span>
              <span style={{ color: '#facc15' }}>{state.detections ? state.detections.length : 0} detections</span>
              <span style={{ color: '#cbd5e1' }}>{state.frame.w}×{state.frame.h}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
