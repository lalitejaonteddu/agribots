"""
Unit tests for InsectDetector (Stage 1 appearance, Stage 2 hybrid video, and interface stability).
"""

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import cv2
import numpy as np
import pytest
from hardware.detector import DetectorConfig, InsectDetector, compute_iou, merge_boxes


def create_synthetic_crop_bed(width=640, height=360) -> np.ndarray:
    """Creates a realistic synthetic crop bed image with soil, green foliage, and textures."""
    # Dark brown soil background (BGR ~ [35, 55, 75])
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :] = (35, 55, 75)

    # Add realistic soil noise / texture
    noise = np.random.default_rng(0).normal(0, 6, (height, width, 3)).astype(np.int16)  # seeded: no flaky tests
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # Add green plant leaves (BGR with strong green channel, e.g. [25, 140, 45])
    # Plant row 1
    cv2.ellipse(img, (200, 180), (70, 35), 25, 0, 360, (25, 145, 45), -1)
    cv2.ellipse(img, (240, 160), (60, 25), -30, 0, 360, (20, 135, 40), -1)
    # Plant row 2
    cv2.ellipse(img, (450, 180), (80, 40), -15, 0, 360, (30, 150, 50), -1)

    return img


def add_synthetic_insect(
    img: np.ndarray, x: int, y: int, size: int = 12, dark: bool = True
) -> np.ndarray:
    """Draws a synthetic insect blob (moth/beetle body with high local contrast)."""
    out = img.copy()
    color = (15, 15, 20) if dark else (210, 215, 220)
    # Oval body
    cv2.ellipse(out, (x, y), (size // 2, max(2, size // 3)), 30, 0, 360, color, -1)
    # Wing highlights/edges
    cv2.circle(out, (x - 2, y), max(1, size // 4), (10, 10, 15) if dark else (240, 240, 245), -1)
    return out


class TestInsectDetectorStage1Appearance:
    """Stage 1: Appearance-based still photo detection tests."""

    def test_still_photo_detects_dark_insect_on_soil(self):
        """Still photos must detect insects by appearance even with 0 motion."""
        img = create_synthetic_crop_bed()
        # Place dark insect on soil at (120, 250)
        img_with_insect = add_synthetic_insect(img, 120, 250, size=14, dark=True)

        config = DetectorConfig(mode="appearance", min_hits_n=1)
        detector = InsectDetector(config)

        boxes = detector.detect_image(img_with_insect)
        assert len(boxes) >= 1, f"Expected at least 1 insect detected in still image, got {boxes}"

        # Verify detected box covers the ground truth location (120, 250)
        bx, by, bw, bh = boxes[0]
        assert bx <= 120 <= bx + bw + 6
        assert by <= 250 <= by + bh + 6

    def test_still_photo_detects_light_insect_on_soil(self):
        """Top-hat morphology must find light/reflective insects on dark soil."""
        img = create_synthetic_crop_bed()
        img_with_insect = add_synthetic_insect(img, 320, 280, size=12, dark=False)

        config = DetectorConfig(mode="appearance", min_hits_n=1)
        detector = InsectDetector(config)

        boxes = detector.detect_image(img_with_insect)
        assert len(boxes) >= 1, "Expected detection for light insect candidate"

    def test_empty_field_has_zero_false_positives(self):
        """Clean crop bed without insects should report 0 false positives."""
        img = create_synthetic_crop_bed()
        config = DetectorConfig(mode="appearance")
        detector = InsectDetector(config)

        boxes = detector.detect_image(img)
        assert len(boxes) == 0, f"Expected 0 detections on empty field, got {len(boxes)}"


class TestInsectDetectorStage2HybridVideo:
    """Stage 2: Hybrid video detection, persistence, and tracking tests."""

    def test_appearance_works_from_frame_1(self):
        """Appearance path must report from frame 1 without waiting for motion warmup."""
        img = create_synthetic_crop_bed()
        img_with_insect = add_synthetic_insect(img, 150, 120, size=14, dark=True)

        # min_hits_n=1 so single confirmed frame reports immediately
        config = DetectorConfig(mode="hybrid", min_hits_n=1)
        detector = InsectDetector(config)

        boxes_frame_1 = detector.process(img_with_insect)
        assert len(boxes_frame_1) >= 1, "Hybrid detector must report insect from frame 1"

    def test_stationary_insect_persists_across_video_frames(self):
        """
        Critical problem requirement:
        Insects that land and sit still disappear in pure MOG2 after a few frames.
        Hybrid detector with persistence tracking must keep them detected.
        """
        img = create_synthetic_crop_bed()
        insect_pos = (280, 220)
        img_with_insect = add_synthetic_insect(img, *insect_pos, size=14, dark=True)

        # 1. Test pure motion (MOG2) - should lose stationary insect after warmup/absorption
        motion_detector = InsectDetector(DetectorConfig(mode="motion", min_hits_n=1, warmup_frames=5))
        motion_counts = []
        for _ in range(25):
            boxes = motion_detector.process(img_with_insect)
            motion_counts.append(len(boxes))

        # Because frame is identical, MOG2 background model absorbs stationary insect -> count becomes 0
        assert motion_counts[-1] == 0, "Pure MOG2 should absorb stationary object to 0"

        # 2. Test hybrid detector - must preserve detection of stationary insect!
        hybrid_detector = InsectDetector(DetectorConfig(mode="hybrid", min_hits_n=1))
        hybrid_counts = []
        for _ in range(25):
            boxes = hybrid_detector.process(img_with_insect)
            hybrid_counts.append(len(boxes))

        assert hybrid_counts[-1] >= 1, "Hybrid detector must maintain detection for landed/still insect!"

    def test_n_of_m_rule_filters_single_frame_flicker(self):
        """Transient single-frame artifact should be rejected by N-of-M rule."""
        img = create_synthetic_crop_bed()
        # Require 2 hits in 5 frames
        config = DetectorConfig(mode="hybrid", history_window_m=5, min_hits_n=2)
        detector = InsectDetector(config)

        # Frame 1: clean
        assert len(detector.process(img)) == 0
        # Frame 2: single-frame noise glitch
        glitch_img = add_synthetic_insect(img, 100, 100, size=10, dark=True)
        assert len(detector.process(glitch_img)) == 0  # Not yet confirmed (hit count = 1 < 2)
        # Frame 3: clean again
        assert len(detector.process(img)) == 0  # Glitch disappeared


class TestInsectDetectorInterfaceAndPerformance:
    """Verifies interface contract and performance constraints."""

    def test_process_signature_and_return_type(self):
        """process(frame_bgr) must return a list of (x, y, w, h) integer tuples."""
        img = create_synthetic_crop_bed()
        detector = InsectDetector()
        result = detector.process(img)

        assert isinstance(result, list)
        for box in result:
            assert len(box) == 4
            x, y, w, h = box
            assert isinstance(x, (int, np.integer))
            assert isinstance(y, (int, np.integer))
            assert isinstance(w, (int, np.integer))
            assert isinstance(h, (int, np.integer))

    def test_framerate_performance_exceeds_pi4_requirement(self):
        """Hybrid detector on 640px width must comfortably exceed the 8 FPS Pi 4 requirement."""
        img = create_synthetic_crop_bed(width=640, height=360)
        img_with_insect = add_synthetic_insect(img, 200, 200, size=12)

        detector = InsectDetector(DetectorConfig(target_width=640))

        # Warm up 3 iterations
        for _ in range(3):
            detector.process(img_with_insect)

        # Measure 15 iterations
        import time

        start = time.perf_counter()
        iterations = 15
        for _ in range(iterations):
            detector.process(img_with_insect)
        elapsed = time.perf_counter() - start

        fps = iterations / elapsed
        stats = detector.get_timing_stats()
        print(f"\n[Performance Benchmark] Effective FPS: {fps:.1f} (Latency: {stats['total_ms']:.2f}ms)")
        assert fps >= 10.0, f"Expected >= 10 FPS, got {fps:.1f} FPS"


class TestInsectDetectorStage3Yolo:
    """Stage 3: Optional learned YOLO ONNX detector via OpenCV DNN."""

    def test_yolo_onnx_model_loads_and_executes(self):
        """Verifies YOLO ONNX model initializes and runs inference on CPU."""
        model_path = Path("hardware/models/yolov8n_insect.onnx")
        if not model_path.exists():
            pytest.skip("YOLO ONNX model not found, skipping Stage 3 test")

        config = DetectorConfig(mode="yolo", onnx_model_path=str(model_path))
        detector = InsectDetector(config)
        assert detector.yolo_net is not None, "YOLO net must be initialized from ONNX"

        img = create_synthetic_crop_bed()
        boxes = detector.detect_image(img)
        assert isinstance(boxes, list)
        assert detector.timings["total_ms"] > 0
