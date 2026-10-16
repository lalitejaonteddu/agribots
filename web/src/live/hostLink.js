import { useState, useEffect, useRef, useCallback } from 'react'

const DEFAULT_HOST = 'http://localhost:8765'

function getSavedHost() {
  try {
    return localStorage.getItem('agribots_host_url') || DEFAULT_HOST
  } catch {
    return DEFAULT_HOST
  }
}

// Global shared state for components
let globalState = {
  connected: false,
  hostUrl: getSavedHost(),
  state: {
    t: Date.now() / 1000,
    fps: 0,
    frame: { w: 640, h: 360 },
    detections: [],
    output: {
      active: false,
      zoneA: false,
      zoneB: false,
      freq: 40000,
      mode: 'AUTO',
      source: 'host-trigger',
    },
    serial: 'NOT CONNECTED',
    camera: 'Waiting for host...',
    warnings: [],
  },
}

const listeners = new Set()
let activeWs = null
let reconnectTimer = null

function notify() {
  for (const fn of listeners) {
    fn(globalState)
  }
}

function connectWebSocket(hostUrl) {
  if (activeWs) {
    try {
      activeWs.close()
    } catch {}
    activeWs = null
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  // Convert http:// to ws://
  const wsUrl = hostUrl.replace(/^http(s)?:\/\//, 'ws$1://') + '/ws'
  let ws
  try {
    ws = new WebSocket(wsUrl)
  } catch (e) {
    scheduleReconnect(hostUrl)
    return
  }

  ws.onopen = () => {
    globalState.connected = true
    notify()
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      globalState.state = {
        ...globalState.state,
        ...data,
      }
      globalState.connected = true
      notify()
    } catch (e) {
      console.warn('[HostLink] Error parsing message:', e)
    }
  }

  ws.onclose = () => {
    if (globalState.connected) {
      globalState.connected = false
      notify()
    }
    activeWs = null
    scheduleReconnect(hostUrl)
  }

  ws.onerror = () => {
    try {
      ws.close()
    } catch {}
  }

  activeWs = ws
}

function scheduleReconnect(hostUrl) {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWebSocket(hostUrl)
  }, 2000)
}

// Start initial connection
connectWebSocket(globalState.hostUrl)

export function useHostState() {
  const [data, setData] = useState(globalState)

  useEffect(() => {
    const listener = (val) => setData({ ...val })
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])

  const setHostUrl = useCallback((newUrl) => {
    let clean = newUrl.trim().replace(/\/+$/, '')
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean
    }
    try {
      localStorage.setItem('agribots_host_url', clean)
    } catch {}
    globalState.hostUrl = clean
    globalState.connected = false
    notify()
    connectWebSocket(clean)
  }, [])

  const setMode = useCallback((mode) => {
    if (activeWs && activeWs.readyState === WebSocket.OPEN) {
      activeWs.send(JSON.stringify({ cmd: 'mode', value: mode }))
    }
  }, [])

  const setFreq = useCallback((freq) => {
    if (activeWs && activeWs.readyState === WebSocket.OPEN) {
      activeWs.send(JSON.stringify({ cmd: 'freq', value: parseInt(freq, 10) }))
    }
  }, [])

  return {
    connected: data.connected,
    hostUrl: data.hostUrl,
    state: data.state,
    setHostUrl,
    setMode,
    setFreq,
  }
}
