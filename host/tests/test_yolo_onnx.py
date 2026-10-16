"""
Unit tests for host/yolo_onnx.py (Part 2a YOLO ONNX Decode & Letterbox Preprocessing).
Tests decoding and NMS against a synthetic fake YOLOv8 output tensor [1, 4 + classes, N].
"""

import sys
from pathlib import Path

import numpy as np
import pytest

HOST_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HOST_DIR))

from yolo_onnx import decode_yolo_output, letterbox


def test_letterbox_maintains_aspect_ratio_and_padding():
    """Validates letterbox scaling and border calculation for widescreen input."""
    img = np.zeros((360, 640, 3), dtype=np.uint8)
    padded, scale, (pad_w, pad_h) = letterbox(img, target_shape=(640, 640))

    assert padded.shape == (640, 640, 3)
    assert scale == 1.0  # Width matches 640
    assert pad_w == 0
    assert pad_h == 140  # (640 - 360) / 2 = 140


def test_decode_yolo_output_with_fake_tensor():
    """
    Constructs a synthetic fake output tensor with 3 anchor predictions:
    1) Valid target insect at center with conf=0.88
    2) Sub-threshold noise candidate with conf=0.12 (must be rejected)
    3) Overlapping duplicate box (must be suppressed by NMS)
    """
    num_classes = 1
    num_anchors = 100
    # Tensor shape: [1, 5, 100]
    fake_tensor = np.zeros((1, 4 + num_classes, num_anchors), dtype=np.float32)

    # 1. High confidence target insect at padded coords: cx=320, cy=320, w=32, h=32
    fake_tensor[0, 0, 10] = 320.0
    fake_tensor[0, 1, 10] = 320.0
    fake_tensor[0, 2, 10] = 32.0
    fake_tensor[0, 3, 10] = 32.0
    fake_tensor[0, 4, 10] = 0.88  # High confidence

    # 2. Low confidence candidate (must be filtered by conf_thresh=0.25)
    fake_tensor[0, 0, 20] = 100.0
    fake_tensor[0, 1, 20] = 100.0
    fake_tensor[0, 2, 20] = 20.0
    fake_tensor[0, 3, 20] = 20.0
    fake_tensor[0, 4, 20] = 0.12  # < 0.25

    # 3. Overlapping box at same location with slightly lower confidence (NMS duplicate)
    fake_tensor[0, 0, 30] = 321.0
    fake_tensor[0, 1, 30] = 319.0
    fake_tensor[0, 2, 30] = 30.0
    fake_tensor[0, 3, 30] = 31.0
    fake_tensor[0, 4, 30] = 0.82

    scale = 1.0
    pad = (0, 140)
    orig_shape = (360, 640)

    detections = decode_yolo_output(
        fake_tensor,
        scale=scale,
        pad=pad,
        orig_shape=orig_shape,
        conf_thresh=0.25,
        nms_thresh=0.45,
    )

    # NMS should keep exactly 1 detection (the highest confidence one)
    assert len(detections) == 1, f"Expected 1 detection after NMS, got {len(detections)}"

    (x, y, w, h), conf, cls_id = detections[0]
    assert cls_id == 0
    assert abs(conf - 0.88) < 1e-4

    # Unpadded coordinates: x = 320 - 16 - 0 = 304, y = 320 - 16 - 140 = 164
    assert abs(x - 304) <= 1
    assert abs(y - 164) <= 1
    assert abs(w - 32) <= 1
    assert abs(h - 32) <= 1
