"""
Unit tests for host/detector.py (Part 2c Acceptance Criteria).
- Synthetic insect-like blobs on soil/leaf background -> recall >= 0.9
- Plain background -> 0 detections
"""

import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

HOST_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HOST_DIR))

from detector import DetectorConfig, InsectDetector, compute_iou


def create_synthetic_scene(width=640, height=360) -> np.ndarray:
    """Generates synthetic soil background with leafy green vegetation."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = (35, 55, 75)  # Soil color in BGR

    # Texture noise
    noise = np.random.normal(0, 5, (height, width, 3)).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # Leaves
    cv2.ellipse(img, (200, 180), (60, 30), 30, 0, 360, (25, 145, 45), -1)
    cv2.ellipse(img, (440, 180), (70, 35), -20, 0, 360, (30, 150, 50), -1)
    return img


def add_synthetic_bug(img: np.ndarray, x: int, y: int, size: int = 12) -> np.ndarray:
    """Inserts a synthetic insect-like high-contrast blob."""
    out = img.copy()
    cv2.ellipse(out, (x, y), (size // 2, max(2, size // 3)), 45, 0, 360, (15, 15, 20), -1)
    cv2.circle(out, (x - 2, y), max(1, size // 4), (10, 10, 15), -1)
    return out


def test_plain_background_has_zero_false_positives():
    """A plain crop-bed background without insects must yield 0 detections."""
    img = create_synthetic_scene()
    cfg = DetectorConfig(mode="hybrid", min_hits_n=1)
    detector = InsectDetector(cfg)

    boxes = detector.detect_image(img)
    assert len(boxes) == 0, f"Expected 0 detections on empty background, got {len(boxes)}"


def test_synthetic_insects_recall_exceeds_90_percent():
    """
    Acceptance Criteria (Part 2c):
    Synthetic insect-like blobs on soil/leaf background -> recall >= 0.9 for hybrid detector.
    """
    cfg = DetectorConfig(mode="hybrid", min_hits_n=1, min_area=4.0, min_contrast=8.0)
    detector = InsectDetector(cfg)

    num_trials = 10
    hits = 0

    # Test 10 distinct synthetic insect placements across soil and foliage borders
    positions = [
        (100, 100), (120, 260), (320, 120), (340, 280), (500, 100),
        (520, 260), (220, 240), (420, 240), (280, 200), (160, 160)
    ]

    for x, y in positions:
        base = create_synthetic_scene()
        test_frame = add_synthetic_bug(base, x, y, size=14)
        boxes = detector.detect_image(test_frame)

        # Check if any detection matches the ground-truth location
        matched = False
        for bx, by, bw, bh in boxes:
            if compute_iou((bx, by, bw, bh), (x - 8, y - 8, 16, 16)) > 0.05 or (
                bx - 10 <= x <= bx + bw + 10 and by - 10 <= y <= by + bh + 10
            ):
                matched = True
                break
        if matched:
            hits += 1

    recall = hits / num_trials
    print(f"\n[Test Synthetic Recall] Hits: {hits}/{num_trials} -> Recall = {recall:.2f}")
    assert recall >= 0.90, f"Expected recall >= 0.90, got {recall:.2f}"
