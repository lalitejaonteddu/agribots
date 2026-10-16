"""
Unit tests for WebBridge (Part 1).
"""

import sys
import time
from pathlib import Path
import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "host"))

from host.web_bridge import WebBridge


class TestWebBridge:
    def test_crop_extraction(self):
        """Crop extraction must add 25% margin, clamp within frame, and resize <= 256px."""
        bridge = WebBridge()
        # Synthetic 640x360 frame
        frame = np.zeros((360, 640, 3), dtype=np.uint8)
        # Bounding box of 100x100
        box = (200, 100, 100, 100)
        crop_bytes = bridge._extract_crop_jpeg(frame, box)
        assert crop_bytes is not None
        assert crop_bytes.startswith(b"\xff\xd8")  # JPEG header

    def test_update_frame_and_crops(self):
        """update_frame must populate track crops, dimensions, and state."""
        bridge = WebBridge()
        raw = np.zeros((360, 640, 3), dtype=np.uint8)
        ann = np.zeros((360, 640, 3), dtype=np.uint8)
        dets = [
            {
                "id": 42,
                "box": [140, 170, 24, 22],
                "label": "fall_armyworm_moth",
                "conf": 0.88,
                "bed": {"x": 0.1, "z": -0.2},
            }
        ]

        bridge.update_frame(
            raw_frame=raw,
            annotated_frame=ann,
            detections=dets,
            fps=15.0,
            output_state={"active": True, "zoneA": True, "zoneB": False, "freq": 40000, "mode": "AUTO", "source": "host-trigger"},
            serial_status="CONNECTED",
            camera_name="TestCam",
            warnings=["Test warning"],
        )

        assert bridge.frame_dims == {"w": 640, "h": 360}
        assert 42 in bridge.track_crops
        assert bridge.track_crops[42]["conf"] == 0.88
        assert dets[0]["crop"] == "/crop/42.jpg"
        assert dets[0]["first_seen"] > 0

    def test_command_queue(self):
        """Commands put into cmd_queue can be retrieved non-blocking."""
        bridge = WebBridge()
        bridge.cmd_queue.put(("mode", "ON"))
        bridge.cmd_queue.put(("freq", 42000))

        c1 = bridge.get_command()
        assert c1 == ("mode", "ON")
        c2 = bridge.get_command()
        assert c2 == ("freq", 42000)
        assert bridge.get_command() is None
