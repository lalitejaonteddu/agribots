"""
Strict External USB Webcam Manager for Crop-Sim.

Rules (Mandatory):
1. Must use ONLY an external USB webcam.
2. NEVER open the laptop's built-in camera, phone/Continuity camera, or virtual camera.
3. Multi-OS device discovery (Linux v4l2/sysfs, Windows DirectShow, macOS AVFoundation).
4. Auto-detect single external camera or match by --camera-name.
5. Persist chosen camera identity to host/camera.json.
6. Hot-unplug detection: immediately send ALLOFF to STM32 and retry only the same camera.
"""

from __future__ import annotations

import json
import logging
import os
import platform
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import cv2

logger = logging.getLogger("CropSimCamera")

CAMERA_CONFIG_PATH = Path(__file__).resolve().parent / "camera.json"

# Never usable, not even in --builtin test mode
VIRTUAL_KEYWORDS = ["virtual", "obs", "snap", "continuity", "iphone", "droidcam", "desk view", "camo"]

BUILT_IN_KEYWORDS = [
    "integrated",
    "built-in",
    "facetime",
    "macbook",
    "ir camera",
    "virtual",
    "obs",
    "snap",
    "continuity",
    "iphone",
    "droidcam",
]


@dataclass
class CameraDevice:
    index: int
    name: str
    backend: str
    is_external: bool
    classification_reason: str
    resolution: str = "Unknown"
    unique_id: str = ""
    usb_vid_pid: str = ""


def is_name_virtual(name: str) -> bool:
    lower = name.lower()
    return any(kw in lower for kw in VIRTUAL_KEYWORDS)


def is_name_builtin_or_virtual(name: str) -> Tuple[bool, str]:
    """Checks if a device name matches any forbidden built-in or virtual camera patterns."""
    lower_name = name.lower()
    for kw in BUILT_IN_KEYWORDS:
        if kw in lower_name:
            return True, f"Name contains forbidden keyword '{kw}'"
    # Special check: 'hd webcam' when internal
    if "hd webcam" in lower_name and ("internal" in lower_name or "pc" in lower_name):
        return True, "Internal HD Webcam"
    return False, "External peripheral identifier"


def enumerate_macos_cameras() -> List[CameraDevice]:
    """Enumerates AVFoundation cameras on macOS using system_profiler."""
    devices: List[CameraDevice] = []
    try:
        raw = subprocess.check_output(["system_profiler", "SPCameraDataType"], text=True, stderr=subprocess.DEVNULL)
        # Parse blocks
        chunks = re.split(r"\n\s{4}([A-Za-z0-9][^\n:]+):", raw)
        names = []
        unique_ids = []
        if len(chunks) > 1:
            for i in range(1, len(chunks), 2):
                c_name = chunks[i].strip()
                c_body = chunks[i + 1]
                names.append(c_name)
                uid_match = re.search(r"Unique ID:\s*([^\n]+)", c_body)
                unique_ids.append(uid_match.group(1).strip() if uid_match else "")
        else:
            # Fallback simple regex
            for line in raw.splitlines():
                m = re.match(r"^\s{4}([A-Za-z0-9][^:]+):", line)
                if m and "Camera" not in m.group(1):
                    names.append(m.group(1).strip())

        for idx, name in enumerate(names):
            uid = unique_ids[idx] if idx < len(unique_ids) else ""
            is_builtin, reason = is_name_builtin_or_virtual(name)

            # Probe resolution quickly
            res_str = "Unknown"
            cap = cv2.VideoCapture(idx, cv2.CAP_AVFOUNDATION)
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                res_str = f"{w}x{h}"
                cap.release()

            devices.append(
                CameraDevice(
                    index=idx,
                    name=name,
                    backend="AVFOUNDATION",
                    is_external=not is_builtin,
                    classification_reason=reason,
                    resolution=res_str,
                    unique_id=uid,
                )
            )
    except Exception as e:
        logger.warning("macOS camera enumeration fallback: %s", e)

    return devices


def enumerate_linux_cameras() -> List[CameraDevice]:
    """Enumerates V4L2 cameras on Linux, inspecting /sys/class/video4linux sysfs for 'removable' attribute."""
    devices: List[CameraDevice] = []
    v4l_dir = Path("/sys/class/video4linux")
    if not v4l_dir.exists():
        return devices

    for node in sorted(v4l_dir.glob("video*")):
        try:
            dev_idx = int(node.name.replace("video", ""))
            name_file = node / "name"
            dev_name = name_file.read_text().strip() if name_file.exists() else node.name

            # Skip metadata nodes
            index_file = node / "index"
            if index_file.exists() and index_file.read_text().strip() != "0":
                continue

            # Check removable attribute in USB parent hierarchy
            is_external = False
            reason = "Unknown sysfs hierarchy"
            removable_file = node / "device" / "removable"
            if not removable_file.exists():
                # Walk parents
                curr = node.resolve()
                for _ in range(5):
                    if curr.parent == curr:
                        break
                    curr = curr.parent
                    cand = curr / "removable"
                    if cand.exists():
                        removable_file = cand
                        break

            if removable_file.exists():
                val = removable_file.read_text().strip().lower()
                if val == "removable":
                    is_external = True
                    reason = "USB bus reports removable=removable"
                else:
                    is_external = False
                    reason = f"USB bus reports removable={val} (built-in fixed device)"
            else:
                is_builtin, reason = is_name_builtin_or_virtual(dev_name)
                is_external = not is_builtin

            # Check name keywords
            is_builtin_name, name_reason = is_name_builtin_or_virtual(dev_name)
            if is_builtin_name:
                is_external = False
                reason = name_reason

            devices.append(
                CameraDevice(
                    index=dev_idx,
                    name=dev_name,
                    backend="V4L2",
                    is_external=is_external,
                    classification_reason=reason,
                    unique_id=str(node),
                )
            )
        except Exception:
            continue

    return devices


def enumerate_windows_cameras() -> List[CameraDevice]:
    """Enumerates DirectShow cameras on Windows."""
    devices: List[CameraDevice] = []
    names = []
    try:
        from pygrabber.dshow_graph import FilterGraph

        graph = FilterGraph()
        names = graph.get_input_devices()
    except Exception:
        pass

    if not names:
        # Fallback probe
        for idx in range(6):
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if cap.isOpened():
                names.append(f"DirectShow Camera {idx}")
                cap.release()

    for idx, name in enumerate(names):
        is_builtin, reason = is_name_builtin_or_virtual(name)
        devices.append(
            CameraDevice(
                index=idx,
                name=name,
                backend="DSHOW",
                is_external=not is_builtin,
                classification_reason=reason,
            )
        )
    return devices


def list_all_cameras() -> List[CameraDevice]:
    """Detects and classifies all system cameras according to the host OS."""
    os_name = platform.system()
    if os_name == "Darwin":
        return enumerate_macos_cameras()
    elif os_name == "Linux":
        return enumerate_linux_cameras()
    elif os_name == "Windows":
        return enumerate_windows_cameras()
    else:
        # Generic probe
        devs = []
        for i in range(4):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                devs.append(
                    CameraDevice(
                        index=i,
                        name=f"Camera {i}",
                        backend="ANY",
                        is_external=False,
                        classification_reason="Unknown OS fallback",
                    )
                )
                cap.release()
        return devs


def print_camera_list(devices: Optional[List[CameraDevice]] = None):
    """Outputs camera device table formatted for --list-cameras command."""
    if devices is None:
        devices = list_all_cameras()

    print("\n" + "=" * 90)
    print("CROP-SIM CAMERA DEVICE AUDIT & CLASSIFICATION REPORT")
    print("=" * 90)
    if not devices:
        print("No video capture devices discovered on this host.")
        print("=" * 90 + "\n")
        return

    header = f"{'Idx':<4} | {'Classification':<18} | {'Backend':<12} | {'Resolution':<10} | {'Name & Classification Reason'}"
    print(header)
    print("-" * len(header))

    for d in devices:
        status_tag = "EXTERNAL (ALLOWED)" if d.is_external else "BUILT-IN/VIRTUAL"
        print(f"{d.index:<4} | {status_tag:<18} | {d.backend:<12} | {d.resolution:<10} | {d.name} [{d.classification_reason}]")

    print("=" * 90 + "\n")


def _default_backend() -> str:
    os_name = platform.system()
    return {"Darwin": "AVFOUNDATION", "Linux": "V4L2", "Windows": "DSHOW"}.get(os_name, "ANY")


class ExternalWebcamStream:
    """
    Guarantees exclusive use of an external USB webcam with 1280x720 MJPG resolution,
    autofocus suppression, persistent identity matching, and hot-unplug failsafe.
    """

    # consecutive failed reads before we treat the camera as unplugged
    # (macOS often returns empty frames for the first second while the camera wakes up)
    MAX_FAILED_READS = 30

    def __init__(
        self,
        camera_name: Optional[str] = None,
        target_res: Tuple[int, int] = (1280, 720),
        on_unplug_callback: Optional[Callable[[], None]] = None,
        allow_builtin: bool = False,
        camera_index: Optional[int] = None,
    ):
        self.allow_builtin = allow_builtin
        self.camera_index = camera_index
        self.failed_reads = 0
        self.camera_name_filter = camera_name
        self.target_res = target_res
        self.on_unplug_callback = on_unplug_callback

        self.cap: Optional[cv2.VideoCapture] = None
        self.active_device: Optional[CameraDevice] = None
        self.is_connected = False
        self.delivered_res = (0, 0)
        self.delivered_fps = 0.0

    def select_builtin_camera(self) -> CameraDevice:
        """TEST MODE (--builtin): use the laptop's own camera. Virtual/phone cameras are still refused."""
        devices = list_all_cameras()
        usable = [d for d in devices if not is_name_virtual(d.name)]
        if self.camera_name_filter:
            usable = [d for d in usable if self.camera_name_filter.lower() in d.name.lower()]
        builtins = [d for d in usable if not d.is_external]
        chosen = builtins[0] if builtins else (usable[0] if usable else None)
        if chosen is None:
            # enumeration failed (e.g. no system_profiler output) — fall back to index 0
            chosen = CameraDevice(index=0, name="Camera 0", backend=_default_backend(), is_external=False,
                                  classification_reason="enumeration unavailable, using index 0")
        print(f"[Camera] TEST MODE (--builtin): using '{chosen.name}' (index {chosen.index}). "
              "Remove --builtin to switch to the external USB webcam.")
        return chosen

    def select_camera(self) -> CameraDevice:
        """Finds and verifies the external USB webcam per strict selection rules."""
        if self.camera_index is not None:
            return CameraDevice(index=self.camera_index, name=f"Camera {self.camera_index}",
                                backend=_default_backend(), is_external=True,
                                classification_reason="explicit --camera index")
        if self.allow_builtin:
            return self.select_builtin_camera()
        devices = list_all_cameras()
        externals = [d for d in devices if d.is_external]

        if not externals:
            print_camera_list(devices)
            raise RuntimeError(
                "No external USB webcam found — plug it in or check --list-cameras.\n"
                "System policy strictly prohibits falling back to the built-in or virtual camera."
            )

        # Match by name if provided
        if self.camera_name_filter:
            matches = [d for d in externals if self.camera_name_filter.lower() in d.name.lower()]
            if not matches:
                raise RuntimeError(
                    f"Requested external camera '{self.camera_name_filter}' not found among external devices.\n"
                    f"Available external cameras: {[d.name for d in externals]}"
                )
            chosen = matches[0]
        else:
            if len(externals) > 1:
                print_camera_list(devices)
                raise RuntimeError(
                    f"Multiple external USB webcams found ({[d.name for d in externals]}).\n"
                    f"Please specify which camera to use via --camera-name <name>."
                )
            chosen = externals[0]

        # Check or update camera.json identity
        self._verify_or_save_identity(chosen)
        return chosen


    def _verify_or_save_identity(self, device: CameraDevice):
        if CAMERA_CONFIG_PATH.exists():
            try:
                saved = json.loads(CAMERA_CONFIG_PATH.read_text())
                if saved.get("name") != device.name:
                    logger.warning(
                        "Camera identity mismatch: Previously used '%s', now using '%s'. Updating camera.json.",
                        saved.get("name"),
                        device.name,
                    )
            except Exception:
                pass

        data = {
            "name": device.name,
            "unique_id": device.unique_id,
            "backend": device.backend,
            "last_verified": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        CAMERA_CONFIG_PATH.write_text(json.dumps(data, indent=2))

    def open(self) -> bool:
        device = self.select_camera()
        self.active_device = device

        backend_code = cv2.CAP_ANY
        if device.backend == "AVFOUNDATION":
            backend_code = cv2.CAP_AVFOUNDATION
        elif device.backend == "V4L2":
            backend_code = cv2.CAP_V4L2
        elif device.backend == "DSHOW":
            backend_code = cv2.CAP_DSHOW

        self.cap = cv2.VideoCapture(device.index, backend_code)
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open external camera device {device.name} at index {device.index}.")

        # Configure 1280x720 with MJPG fourcc for max framerate
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        self.cap.set(cv2.CAP_PROP_FOURCC, fourcc)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.target_res[0])
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.target_res[1])

        # Disable autofocus if supported (fixed camera height above bed)
        try:
            self.cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)
        except Exception:
            pass

        # Wait for the first real frame (macOS camera warm-up / permission prompt)
        got = False
        for _ in range(60):
            ok, frame = self.cap.read()
            if ok and frame is not None and frame.size:
                got = True
                break
            time.sleep(0.05)
        if not got:
            raise RuntimeError(
                f"Camera '{device.name}' opened but delivers no frames. On macOS allow camera access for "
                "your terminal/IDE in System Settings > Privacy & Security > Camera, then restart it."
            )

        # Measure delivered properties
        actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
        self.delivered_res = (actual_w, actual_h)
        self.delivered_fps = actual_fps
        self.is_connected = True

        print(f"\n[Camera Initialized] {device.name} @ {actual_w}x{actual_h} ({actual_fps:.1f} FPS)")
        return True

    def read(self) -> Tuple[bool, Optional[Any]]:
        if not self.cap or not self.is_connected:
            return False, None

        ret, frame = self.cap.read()
        if not ret or frame is None:
            # tolerate short glitches; only a sustained loss counts as unplugged
            self.failed_reads += 1
            if self.failed_reads >= self.MAX_FAILED_READS:
                self.handle_disconnect()
            return False, None

        self.failed_reads = 0
        return True, frame

    def handle_disconnect(self):
        """Executes hot-unplug failsafe."""
        if not self.is_connected:
            return
        self.is_connected = False
        print("\n[CRITICAL WARNING] EXTERNAL CAMERA DISCONNECTED / UNPLUGGED!")
        if self.on_unplug_callback:
            try:
                self.on_unplug_callback()
            except Exception as e:
                logger.error("Error in unplug callback: %s", e)

        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

    def attempt_reconnect(self) -> bool:
        """Polls every 2s attempting to reconnect strictly to the same external camera device."""
        if self.is_connected:
            return True
        if not self.active_device:
            return False

        now = time.time()
        if now - getattr(self, "_last_reconnect", 0) < 2.0:
            return False
        self._last_reconnect = now

        try:
            current_devices = list_all_cameras()
            if self.allow_builtin or self.camera_index is not None:
                matches = [self.active_device]
            else:
                matches = [d for d in current_devices if d.is_external and d.name == self.active_device.name]
            if matches:
                print(f"[Camera Reconnect] External camera '{self.active_device.name}' re-detected. Restoring stream...")
                self.active_device = matches[0]
                backend_code = cv2.CAP_ANY
                if self.active_device.backend == "AVFOUNDATION":
                    backend_code = cv2.CAP_AVFOUNDATION
                elif self.active_device.backend == "V4L2":
                    backend_code = cv2.CAP_V4L2
                elif self.active_device.backend == "DSHOW":
                    backend_code = cv2.CAP_DSHOW

                self.cap = cv2.VideoCapture(self.active_device.index, backend_code)
                if self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.target_res[0])
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.target_res[1])
                    self.is_connected = True
                    self.failed_reads = 0
                    print("[Camera Reconnect] Stream successfully restored.")
                    return True
        except Exception:
            pass
        return False

    def release(self):
        self.is_connected = False
        if self.cap:
            self.cap.release()
            self.cap = None
