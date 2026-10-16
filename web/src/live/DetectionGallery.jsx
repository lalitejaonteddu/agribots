import { useState, useEffect } from 'react'
import { getSpeciesColor } from './InsectPhotoCard'

export default function DetectionGallery({ hostState, onFlyTo }) {
  const { connected, hostUrl, state } = hostState
  const [collapsed, setCollapsed] = useState(false)
  const [savedHits, setSavedHits] = useState([])

  // Fetch saved hits from host every 4 seconds
  useEffect(() => {
    if (!connected) return
    let active = true

    const fetchHits = async () => {
      try {
        const res = await fetch(`${hostUrl}/hits.json`)
        if (res.ok) {
          const list = await res.json()
          if (active) setSavedHits(list)
        }
      } catch (e) {
        // host may be busy
      }
    }

    fetchHits()
    const interval = setInterval(fetchHits, 4000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [connected, hostUrl])

  // Merge live detections + saved hits (newest first)
  const liveItems = (state.detections || []).map((d) => ({
    id: `live_${d.id}`,
    isLive: true,
    trackId: d.id,
    label: d.label,
    conf: d.conf,
    time: d.first_seen || Date.now() / 1000,
    cropUrl: `${hostUrl}${d.crop}`,
    bed: d.bed,
  }))

  const savedItems = savedHits.map((h) => ({
    id: `saved_${h.file}`,
    isLive: false,
    trackId: h.file.split('_')[3]?.replace('track', '') || '',
    label: h.file.split('_')[4] || 'insect',
    conf: (parseInt(h.file.split('_')[5], 10) || 80) / 100,
    time: h.time,
    cropUrl: `${hostUrl}${h.url}`,
    bed: null,
  }))

  const allItems = [...liveItems, ...savedItems]
    .sort((a, b) => b.time - a.time)
    .slice(0, 30)

  return (
    <div
      style={{
        position: 'fixed',
        right: '16px',
        top: '64px',
        bottom: '24px',
        width: collapsed ? '44px' : '260px',
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(30, 41, 59, 0.5)',
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>
              REAL DETECTION GALLERY
            </span>
            <span
              style={{
                fontSize: '10px',
                background: '#0284c7',
                color: '#fff',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: '600',
              }}
            >
              {allItems.length}
            </span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '14px',
            lineHeight: '1',
          }}
          title={collapsed ? 'Expand gallery' : 'Collapse gallery'}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </div>

      {/* Gallery cards list */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {allItems.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '11px', textAlign: 'center', marginTop: '30px' }}>
              {connected ? 'Waiting for insect detections...' : 'Host not running'}
            </div>
          ) : (
            allItems.map((item) => {
              const color = getSpeciesColor(item.label)
              const timeStr = new Date(item.time * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.bed && onFlyTo) {
                      onFlyTo(item.bed.x, 0.25 + 0.4, item.bed.z)
                    }
                  }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: `1px solid ${item.isLive ? color : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '6px',
                    padding: '6px',
                    cursor: item.bed ? 'pointer' : 'default',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    transition: 'transform 0.1s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (item.bed) e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  {/* Photo crop preview */}
                  <div
                    style={{
                      width: '60px',
                      height: '50px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      background: '#020617',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={item.cropUrl}
                      alt={item.label}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>

                  {/* Metadata */}
                  <div style={{ flex: 1, minWidth: 0, fontSize: '10px', lineHeight: '1.3' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', color: color, textTransform: 'capitalize' }}>
                        {item.label.replace(/_/g, ' ')}
                      </span>
                      {item.isLive && (
                        <span
                          style={{
                            fontSize: '8px',
                            background: '#16a34a',
                            color: '#fff',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            fontWeight: '700',
                          }}
                        >
                          LIVE
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#cbd5e1', marginTop: '2px' }}>
                      Conf: <span style={{ fontWeight: '600', color: '#38bdf8' }}>{Math.round(item.conf * 100)}%</span>
                      {item.trackId && <span style={{ marginLeft: '6px', color: '#94a3b8' }}>#{item.trackId}</span>}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '9px', marginTop: '2px' }}>
                      {timeStr}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
