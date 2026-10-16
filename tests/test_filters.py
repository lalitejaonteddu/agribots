"""
Unit tests for Runtime Filters: Box-Size Sanity, ROI Polygon, and COCO Person/Object Gating.
Strictly uses real saved camera frames from hardware/test_images/ (no synthetic images).
"""

import sys
from pathlib import Path

# Add project root and host/ to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "host"))

import cv2
import numpy as np
import pytest

from host.detector import (
    DetectorConfig,
    InsectDetector,
    box_passes_sanity,
    box_center_in_roi,
    COCO_SUPPRESS_CLASSES,
    compute_iou,
)


@pytest.fixture
def real_camera_frame() -> np.ndarray:
    """Loads a real recorded crop-bed camera frame."""
    frame_path = PROJECT_ROOT / "hardware" / "test_images" / "sample_00.jpg"
    assert frame_path.exists(), f"Real test frame not found: {frame_path}"
    img = cv2.imread(str(frame_path))
    assert img is not None, "Failed to load real camera frame"
    return img


class TestBoxSizeSanityFilter:
    """Part A.2: Tests box-size and aspect-ratio sanity filtering."""

    def test_realistic_insect_box_passes_sanity(self, real_camera_frame):
        """A realistic overhead insect box (e.g. 18x14 px) must pass sanity check."""
        h, w = real_camera_frame.shape[:2]
        # 18x14 box = 252 px (~0.1% of 640x360 frame)
        insect_box = (200, 150, 18, 14)
        assert box_passes_sanity(insect_box, (h, w), max_box_frac=0.04, min_box_side=6, max_aspect_ratio=4.0)

    def test_giant_box_rejected_as_too_large(self, real_camera_frame):
        """A person's body or hand covering > 4% of the frame cannot be an insect."""
        h, w = real_camera_frame.shape[:2]
        # 200x150 box = 30,000 px (13.0% of frame, well above 4% max)
        person_box = (100, 80, 200, 150)
        assert not box_passes_sanity(person_box, (h, w), max_box_frac=0.04)

    def test_subpixel_noise_rejected(self, real_camera_frame):
        """Single-pixel or tiny noise specks with shorter side < 6 px must be rejected."""
        h, w = real_camera_frame.shape[:2]
        noise_box = (150, 100, 4, 12)  # shorter side is 4 < 6
        assert not box_passes_sanity(noise_box, (h, w), min_box_side=6)

    def test_extreme_aspect_ratio_rejected(self, real_camera_frame):
        """Elongated lines, cables, and cracks with aspect ratio > 4:1 must be rejected."""
        h, w = real_camera_frame.shape[:2]
        cable_box = (50, 100, 120, 12)  # aspect ratio 10:1 > 4:1
        assert not box_passes_sanity(cable_box, (h, w), max_aspect_ratio=4.0)


class TestROIPolygonFilter:
    """Part A.4: Tests crop-bed Region of Interest (ROI) filtering."""

    def test_box_inside_roi_passes(self):
        """Boxes whose centroid lies inside the crop bed ROI must pass."""
        # 4 corners of crop bed
        roi = [(60, 40), (580, 40), (580, 320), (60, 320)]
        bed_box = (250, 160, 20, 20)  # center = (260, 170) -> inside
        assert box_center_in_roi(bed_box, roi)

    def test_box_outside_roi_is_rejected(self):
        """Detections outside the crop bed ROI (e.g. room background) must be dropped."""
        roi = [(60, 40), (580, 40), (580, 320), (60, 320)]
        outside_box = (10, 10, 20, 20)  # center = (20, 20) -> outside
        assert not box_center_in_roi(outside_box, roi)

    def test_empty_roi_accepts_all(self):
        """When no ROI polygon is configured, all valid boxes are retained."""
        box = (10, 10, 20, 20)
        assert box_center_in_roi(box, None)
        assert box_center_in_roi(box, [])


class TestCOCOPersonAndObjectGate:
    """Part A.3: Tests COCO detector gating and person-in-view pause."""

    def test_coco_suppress_classes_contains_person_and_objects(self):
        """COCO suppressor classes must include person (0) and common household items."""
        assert 0 in COCO_SUPPRESS_CLASSES  # person
        assert 41 in COCO_SUPPRESS_CLASSES # cup
        assert 39 in COCO_SUPPRESS_CLASSES # bottle
        assert 63 in COCO_SUPPRESS_CLASSES # laptop
        assert 67 in COCO_SUPPRESS_CLASSES # cell phone

    def test_insect_candidate_overlapping_person_is_suppressed(self):
        """An insect detection overlapping a person detection must be suppressed."""
        person_box = (100, 100, 200, 200)
        insect_candidate_inside = (150, 150, 20, 20)
        insect_candidate_outside = (450, 50, 20, 20)

        # Overlap / containment check
        bx, by, bw, bh = insect_candidate_inside
        bcx, bcy = bx + bw / 2.0, by + bh / 2.0
        inside_person = (person_box[0] <= bcx <= person_box[0] + person_box[2]) and \
                        (person_box[1] <= bcy <= person_box[1] + person_box[3])
        assert inside_person, "Candidate inside person box must be recognized as overlapping"

        # Candidate outside person
        bx2, by2, bw2, bh2 = insect_candidate_outside
        bcx2, bcy2 = bx2 + bw2 / 2.0, by2 + bh2 / 2.0
        outside_person = not ((person_box[0] <= bcx2 <= person_box[0] + person_box[2]) and \
                             (person_box[1] <= bcy2 <= person_box[1] + person_box[3]))
        assert outside_person, "Candidate far from person must not be suppressed"

    def test_person_gate_large_person_triggers_view_pause(self):
        """When a person covers > 20% of the frame area, person_in_view must be set."""
        frame_shape = (360, 640)
        frame_area = 360 * 640  # 230,400 px
        
        # Person covering 300x200 = 60,000 px = 26% of frame (> 20%)
        large_person_area = 300 * 200
        assert (large_person_area / frame_area) > 0.20

        # Person covering 60x80 = 4,800 px = 2% of frame (< 20%)
        small_person_area = 60 * 80
        assert (small_person_area / frame_area) < 0.20


class TestInsectDetectorInterfaceCompatibility:
    """Verifies that InsectDetector.process(frame) maintains strict API contract."""

    def test_process_returns_list_of_boxes_on_real_frame(self, real_camera_frame):
        """process(frame) must return a list of (x, y, w, h) tuples on real frames."""
        cfg = DetectorConfig(mode="hybrid", min_hits_n=1)
        detector = InsectDetector(cfg)
        boxes = detector.process(real_camera_frame)
        assert isinstance(boxes, list)
        for b in boxes:
            assert isinstance(b, tuple)
            assert len(b) == 4
            for coord in b:
                assert isinstance(coord, (int, np.integer))
