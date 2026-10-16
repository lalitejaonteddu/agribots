#!/usr/bin/env bash
# ==============================================================================
# AI-TO-BOTS / CROP-SIM — Unified Real Perception & 3D Live Mirror Runner
# ==============================================================================
# Usage:
#   ./run_all.sh              # Default: MacBook builtin camera + WebBridge
#   ./run_all.sh --camera 1   # External USB webcam + WebBridge
#   ./run_all.sh --video hardware/test_cropbed.mp4 --mock-serial # Video playback
# ==============================================================================

set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Resolve python interpreter
PYTHON="$PROJECT_ROOT/.venv/bin/python"
if [ ! -f "$PYTHON" ]; then
    PYTHON="python3"
fi

echo "================================================================="
echo "Starting Crop-Sim Host Perception Engine & 3D Live Web Mirror"
echo "================================================================="

# Trap termination to kill child background processes cleanly
cleanup() {
    echo -e "\n[Shutdown] Stopping web server and host perception engine..."
    kill 0 2>/dev/null || true
    wait 2>/dev/null || true
    echo "[Shutdown] All services stopped."
}
trap cleanup EXIT INT TERM

# Clean up any stale listeners on ports 5173 or 8765 before launching
echo "[0/3] Clearing stale processes on ports 5173 & 8765..."
lsof -ti :5173 -ti :8765 | xargs kill -9 2>/dev/null || true
sleep 0.5

# 1. Start Python Perception Host in background
echo "[1/3] Launching Python Host Supervisor (Port 8765)..."
"$PYTHON" host/main.py --builtin --web "$@" &
HOST_PID=$!

# Wait for WebBridge to become responsive
echo "[2/3] Waiting for WebBridge WebSocket server..."
for i in {1..30}; do
    if curl -s -o /dev/null "http://127.0.0.1:8765/hits.json" 2>/dev/null; then
        echo "      WebBridge is UP at http://127.0.0.1:8765"
        break
    fi
    sleep 0.5
done

# 2. Start Vite Dev Server in web/ directory
echo "[3/3] Starting Vite Web Server on port 5173..."
(cd web && npm run dev -- --host 0.0.0.0 --port 5173) &
VITE_PID=$!

sleep 2

# Open browser on macOS
if command -v open >/dev/null 2>&1; then
    open "http://localhost:5173"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173"
fi

echo "================================================================="
echo "Crop-Sim 3D Live Mirror is running at http://localhost:5173"
echo "Press [Ctrl+C] to stop all services."
echo "================================================================="

# Wait on background processes
wait
