"""
Crop-Sim Web Bridge & Live Streaming Server (Part 1).

Runs an aiohttp async server in a background daemon thread on port 8765.
Endpoints:
- GET /stream.mjpg               -> MJPEG live stream (<= 15 fps, quality 75), ?boxes=1 draws boxes.
- GET /crop/<track_id>.jpg       -> Latest crop of that track (25% margin, max 256px), updated on better conf.
- GET /hits/<filename>           -> Static hit photo from captures/hits/
- GET /hits.json                 -> JSON list of recent saved hits.
- GET /ws                        -> WebSocket state broadcast @ 10 Hz & command receiver.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import cv2
import numpy as np
from aiohttp import web

logger = logging.getLogger("web_bridge")


class WebBridge:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8765,
        hits_dir: Optional[Path] = None,
    ):
        self.host = host
        self.port = port
        self.hits_dir = hits_dir or Path("captures/hits")
        self.hits_dir.mkdir(parents=True, exist_ok=True)

        # Thread-safe shared state
        self._lock = threading.Lock()
        self.latest_raw_frame: Optional[np.ndarray] = None
        self.latest_annotated_frame: Optional[np.ndarray] = None
        self.latest_raw_jpeg: Optional[bytes] = None
        self.latest_annotated_jpeg: Optional[bytes] = None
        self.frame_dims: Dict[str, int] = {"w": 640, "h": 360}
        self.fps: float = 0.0

        # Crops: track_id -> {"jpeg": bytes, "conf": float, "box": tuple}
        self.track_crops: Dict[int, Dict[str, Any]] = {}
        self.track_first_seen: Dict[int, float] = {}

        # Detections & System state
        self.detections: List[Dict[str, Any]] = []
        self.output_state: Dict[str, Any] = {
            "active": False,
            "zoneA": False,
            "zoneB": False,
            "freq": 40000,
            "mode": "AUTO",
            "source": "host-trigger",
        }
        self.serial_status: str = "NOT CONNECTED"
        self.camera_name: str = "Webcam"
        self.warnings: List[str] = []

        # Command queue from WebSocket to main loop
        self.cmd_queue: queue.Queue[Tuple[str, Any]] = queue.Queue()

        # aiohttp app and connected websockets
        self.app = web.Application(middlewares=[self._cors_middleware])
        self.ws_clients: Set[web.WebSocketResponse] = set()
        self._setup_routes()

        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._running = False

    @web.middleware
    async def _cors_middleware(self, request: web.Request, handler):
        """Allows CORS for Vite dev server (port 5173) and any local client."""
        if request.method == "OPTIONS":
            resp = web.Response(status=204)
        else:
            try:
                resp = await handler(request)
            except web.HTTPException as ex:
                resp = ex

        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    def _setup_routes(self):
        self.app.router.add_get("/", self._handle_index)
        self.app.router.add_get("/stream.mjpg", self._handle_stream)
        self.app.router.add_get(r"/crop/{track_id:\d+}.jpg", self._handle_crop)
        self.app.router.add_get("/hits.json", self._handle_hits_list)
        self.app.router.add_get(r"/hits/{filename:[^/]+}", self._handle_hit_file)
        self.app.router.add_get("/ws", self._handle_ws)

    async def _handle_index(self, request: web.Request) -> web.Response:
        """Friendly landing page on port 8765 directing users to the 3D mirror and streams."""
        html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Crop-Sim Host WebBridge</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f141c; color: #e2e8f0; padding: 40px; text-align: center; }
        .card { max-width: 600px; margin: 0 auto; background: #1a2234; border: 1px solid #2d3b55; border-radius: 12px; padding: 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        h1 { color: #38bdf8; margin-top: 0; }
        p { color: #94a3b8; line-height: 1.6; }
        .btn { display: inline-block; padding: 12px 24px; background: #0284c7; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 12px 6px; transition: background 0.2s; }
        .btn:hover { background: #0369a1; }
        .btn-sub { background: #334155; }
        .btn-sub:hover { background: #475569; }
        .links { margin-top: 24px; border-top: 1px solid #2d3b55; padding-top: 16px; font-size: 0.9em; }
        .links a { color: #38bdf8; margin: 0 10px; text-decoration: none; }
        .links a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🌱 Crop-Sim Perception Host</h1>
        <p>The host perception engine and WebBridge server are active.</p>
        <p>To view the <strong>Live 3D Mirror & Insect Tracker</strong>, open the web app:</p>
        <a class="btn" href="http://localhost:5173" target="_blank">🚀 Open 3D Live Mirror (Port 5173)</a>
        <div class="links">
            <a href="/stream.mjpg?boxes=1" target="_blank">📹 Live Camera Feed</a>
            <a href="/hits.json" target="_blank">📋 Recorded Hits JSON</a>
        </div>
    </div>
</body>
</html>"""
        return web.Response(text=html, content_type="text/html")

    # -------------------------------------------------------------------------
    # Frame & State Ingestion (Called from OpenCV Main Thread)
    # -------------------------------------------------------------------------

    def update_frame(
        self,
        raw_frame: np.ndarray,
        annotated_frame: np.ndarray,
        detections: List[Dict[str, Any]],
        fps: float,
        output_state: Dict[str, Any],
        serial_status: str,
        camera_name: str,
        warnings: Optional[List[str]] = None,
    ):
        """Thread-safe ingestion of frame, track crops, and state."""
        h, w = raw_frame.shape[:2]
        now = time.time()

        # Update track crops with 25% margin
        for det in detections:
            tid = det["id"]
            conf = det.get("conf", 0.0)
            box = det["box"]

            if tid not in self.track_first_seen:
                self.track_first_seen[tid] = now
            det["first_seen"] = self.track_first_seen[tid]
            det["crop"] = f"/crop/{tid}.jpg"

            # Check if this detection provides a higher confidence crop
            existing = self.track_crops.get(tid)
            if existing is None or conf > existing["conf"]:
                crop_jpeg = self._extract_crop_jpeg(raw_frame, box)
                if crop_jpeg:
                    self.track_crops[tid] = {
                        "jpeg": crop_jpeg,
                        "conf": conf,
                        "box": box,
                        "time": now,
                    }

        # Encode JPEG frames (quality 75)
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 75]
        _, raw_jpg = cv2.imencode(".jpg", raw_frame, encode_params)
        _, ann_jpg = cv2.imencode(".jpg", annotated_frame, encode_params)

        with self._lock:
            self.latest_raw_jpeg = raw_jpg.tobytes()
            self.latest_annotated_jpeg = ann_jpg.tobytes()
            self.frame_dims = {"w": w, "h": h}
            self.fps = round(float(fps), 1)
            self.detections = detections
            self.output_state = dict(output_state)
            self.serial_status = serial_status
            self.camera_name = camera_name
            self.warnings = list(warnings or [])

    def _extract_crop_jpeg(self, frame: np.ndarray, box: Tuple[int, int, int, int]) -> Optional[bytes]:
        """Crops box with 25% margin, clamps to frame bounds, resizes to max 256px."""
        bx, by, bw, bh = box
        if bw <= 0 or bh <= 0:
            return None
        fh, fw = frame.shape[:2]

        margin_x = int(bw * 0.25)
        margin_y = int(bh * 0.25)
        x1 = max(0, bx - margin_x)
        y1 = max(0, by - margin_y)
        x2 = min(fw, bx + bw + margin_x)
        y2 = min(fh, by + bh + margin_y)

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return None

        # Resize to max 256px on longest side
        ch, cw = crop.shape[:2]
        max_dim = max(ch, cw)
        if max_dim > 256:
            scale = 256.0 / max_dim
            crop = cv2.resize(crop, (int(cw * scale), int(ch * scale)), interpolation=cv2.INTER_AREA)

        _, buf = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        return buf.tobytes()

    def save_hit(self, frame: np.ndarray, det: Dict[str, Any]) -> Optional[str]:
        """Saves a high-confidence detection photo to captures/hits/."""
        now_str = time.strftime("%Y%m%d_%H%M%S")
        tid = det.get("id", 0)
        label = det.get("label", "insect")
        conf = det.get("conf", 0.0)
        fname = f"hit_{now_str}_track{tid}_{label}_{int(conf*100)}.jpg"
        fpath = self.hits_dir / fname

        vis = frame.copy()
        bx, by, bw, bh = det["box"]
        cv2.rectangle(vis, (bx, by), (bx + bw, by + bh), (0, 255, 128), 2)
        cv2.putText(vis, f"{label} {conf:.0%}", (bx, max(20, by - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 128), 1)
        cv2.imwrite(str(fpath), vis)
        return fname

    def get_command(self) -> Optional[Tuple[str, Any]]:
        """Non-blocking retrieval of commands sent from the browser."""
        try:
            return self.cmd_queue.get_nowait()
        except queue.Empty:
            return None

    # -------------------------------------------------------------------------
    # aiohttp Request Handlers
    # -------------------------------------------------------------------------

    async def _handle_stream(self, request: web.Request) -> web.StreamResponse:
        """Multipart MJPEG video stream (<= 15 fps)."""
        draw_boxes = request.query.get("boxes", "0") in ("1", "true")
        resp = web.StreamResponse(
            status=200,
            reason="OK",
            headers={
                "Content-Type": "multipart/x-mixed-replace; boundary=--frame",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
        await resp.prepare(request)

        try:
            while self._running:
                with self._lock:
                    jpg_bytes = self.latest_annotated_jpeg if draw_boxes else self.latest_raw_jpeg

                if jpg_bytes:
                    chunk = (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: " + str(len(jpg_bytes)).encode("ascii") + b"\r\n\r\n"
                        + jpg_bytes + b"\r\n"
                    )
                    await resp.write(chunk)
                await asyncio.sleep(0.066)  # Cap stream at ~15 fps
        except (ConnectionResetError, asyncio.CancelledError):
            pass
        return resp

    async def _handle_crop(self, request: web.Request) -> web.Response:
        """Returns the cached JPEG crop for the requested track ID."""
        track_id = int(request.match_info["track_id"])
        with self._lock:
            crop_info = self.track_crops.get(track_id)

        if not crop_info or not crop_info.get("jpeg"):
            return web.Response(status=404, text=f"No crop available for track {track_id}")

        return web.Response(
            body=crop_info["jpeg"],
            content_type="image/jpeg",
            headers={"Cache-Control": "no-cache, max-age=0"},
        )

    async def _handle_hits_list(self, request: web.Request) -> web.Response:
        """Lists saved detection photos from captures/hits/ (newest first)."""
        hits = []
        if self.hits_dir.exists():
            for p in sorted(self.hits_dir.glob("*.jpg"), key=lambda f: f.stat().st_mtime, reverse=True)[:30]:
                hits.append({
                    "file": p.name,
                    "url": f"/hits/{p.name}",
                    "time": p.stat().st_mtime,
                    "size": p.stat().st_size,
                })
        return web.json_response(hits)

    async def _handle_hit_file(self, request: web.Request) -> web.Response:
        """Serves a saved hit photo file."""
        filename = request.match_info["filename"]
        target = self.hits_dir / filename
        if not target.exists():
            return web.Response(status=404, text="Hit photo not found")
        return web.FileResponse(target)

    async def _handle_ws(self, request: web.Request) -> web.WebSocketResponse:
        """WebSocket handler broadcasting state @ 10 Hz and receiving user commands."""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.ws_clients.add(ws)

        async def reader():
            async for msg in ws:
                if msg.type == web.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        cmd = data.get("cmd")
                        val = data.get("value")
                        if cmd in ("mode", "freq"):
                            self.cmd_queue.put((cmd, val))
                    except Exception as e:
                        logger.warning("Failed parsing WS command: %s", e)

        read_task = asyncio.create_task(reader())
        try:
            while not ws.closed and self._running:
                # 10 Hz State Broadcast
                with self._lock:
                    payload = {
                        "t": time.time(),
                        "fps": self.fps,
                        "frame": dict(self.frame_dims),
                        "detections": list(self.detections),
                        "output": dict(self.output_state),
                        "serial": self.serial_status,
                        "camera": self.camera_name,
                        "warnings": list(self.warnings),
                    }
                await ws.send_str(json.dumps(payload))
                await asyncio.sleep(0.10)  # 10 Hz
        finally:
            read_task.cancel()
            self.ws_clients.discard(ws)

        return ws

    # -------------------------------------------------------------------------
    # Server Lifecycle
    # -------------------------------------------------------------------------

    def start(self):
        """Starts the aiohttp server in a dedicated background daemon thread."""
        self._running = True
        self._thread = threading.Thread(target=self._run_server, daemon=True, name="WebBridgeThread")
        self._thread.start()
        print(f"\n[WebBridge] Started server on http://{self.host}:{self.port} (WebSocket on /ws)")

    def _run_server(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        runner = web.AppRunner(self.app)
        self._loop.run_until_complete(runner.setup())
        site = web.TCPSite(runner, self.host, self.port)
        self._loop.run_until_complete(site.start())
        try:
            self._loop.run_forever()
        finally:
            self._loop.run_until_complete(runner.cleanup())
            self._loop.close()

    def stop(self):
        """Stops the aiohttp background server."""
        self._running = False
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=1.0)
        print("[WebBridge] Server stopped.")
