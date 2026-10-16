import sys
from pathlib import Path
import pytest
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "host"))

from host.homography import BedHomography


class TestBedHomography:
    @pytest.fixture
    def calibrated_homography(self) -> BedHomography:
        # Synthetic square / trapezoid image corners representing a camera view:
        # FL: (100, 600), FR: (900, 600), BR: (800, 200), BL: (200, 200)
        corners = [
            (100.0, 600.0),  # FL
            (900.0, 600.0),  # FR
            (800.0, 200.0),  # BR
            (200.0, 200.0),  # BL
        ]
        return BedHomography(corners=corners)

    def test_corner_projections(self, calibrated_homography):
        """Corner points must project exactly to known metric coordinates."""
        # 0: Front-Left -> (-1.0, 0.5)
        fl = calibrated_homography.pixel_to_bed(100.0, 600.0)
        assert fl is not None
        assert pytest.approx(fl["x"], abs=0.01) == -1.0
        assert pytest.approx(fl["z"], abs=0.01) == 0.5

        # 1: Front-Right -> (1.0, 0.5)
        fr = calibrated_homography.pixel_to_bed(900.0, 600.0)
        assert fr is not None
        assert pytest.approx(fr["x"], abs=0.01) == 1.0
        assert pytest.approx(fr["z"], abs=0.01) == 0.5

        # 2: Back-Right -> (1.0, -0.5)
        br = calibrated_homography.pixel_to_bed(800.0, 200.0)
        assert br is not None
        assert pytest.approx(br["x"], abs=0.01) == 1.0
        assert pytest.approx(br["z"], abs=0.01) == -0.5

        # 3: Back-Left -> (-1.0, -0.5)
        bl = calibrated_homography.pixel_to_bed(200.0, 200.0)
        assert bl is not None
        assert pytest.approx(bl["x"], abs=0.01) == -1.0
        assert pytest.approx(bl["z"], abs=0.01) == -0.5

    def test_center_projection(self, calibrated_homography):
        """Intersection of diagonals must map close to center (0.0, 0.0)."""
        # Linear midpoint between FL and BR, BL and FR
        # In a planar homography, the harmonic center maps to (0, 0)
        center = calibrated_homography.pixel_to_bed(500.0, 360.0)
        assert center is not None
        assert pytest.approx(center["x"], abs=0.1) == 0.0
        assert pytest.approx(center["z"], abs=0.1) == 0.0

    def test_outside_points_return_none(self, calibrated_homography):
        """Points clearly outside the bed must return None."""
        far_outside = calibrated_homography.pixel_to_bed(50.0, 50.0)
        assert far_outside is None

    def test_box_center_mapping(self, calibrated_homography):
        """BBox center maps to bed coordinate correctly."""
        # Box centered at (500, 360): (480, 340, 40, 40)
        res = calibrated_homography.box_to_bed((480, 340, 40, 40))
        assert res is not None
        assert -1.0 <= res["x"] <= 1.0
        assert -0.5 <= res["z"] <= 0.5

    def test_missing_roi_warning(self, tmp_path):
        """Missing roi.json provides warning and null projections."""
        empty_hom = BedHomography(roi_path=tmp_path / "nonexistent.json")
        assert empty_hom.H is None
        assert "Run --roi-setup" in empty_hom.warning
        assert empty_hom.pixel_to_bed(100, 100) is None
