"""
Image-to-Bed Metric Homography Calibration & Projection (Part 2).

Maps camera image coordinates (u, v) in pixels to planter bed coordinates (x, z) in metres:
- Length: X in [-1.0, 1.0] metres (origin at center)
- Width:  Z in [-0.5, 0.5] metres (origin at center)
Aligns with web/src/config/setup.js.

Expected 4 ROI corners clicked in exact order:
0: Front-Left  (FL) -> (-1.0,  0.5)
1: Front-Right (FR) -> ( 1.0,  0.5)
2: Back-Right  (BR) -> ( 1.0, -0.5)
3: Back-Left   (BL) -> (-1.0, -0.5)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np


class BedHomography:
    """Transforms 2D pixel coordinates to 3D bed metric ground coordinates (x, z)."""

    BED_CORNERS = np.array(
        [
            [-1.0, 0.5],   # 0: Front-Left
            [1.0, 0.5],    # 1: Front-Right
            [1.0, -0.5],   # 2: Back-Right
            [-1.0, -0.5],  # 3: Back-Left
        ],
        dtype=np.float32,
    )

    def __init__(self, roi_path: Optional[Path | str] = None, corners: Optional[List[Tuple[float, float]]] = None):
        self.roi_path = Path(roi_path) if roi_path else None
        self.corners: Optional[List[Tuple[float, float]]] = None
        self.H: Optional[np.ndarray] = None
        self.warning: Optional[str] = None

        if corners and len(corners) == 4:
            self.set_corners(corners)
        elif self.roi_path and self.roi_path.exists():
            self.load_roi()
        else:
            self.warning = "Run --roi-setup to place insects in 3D"

    def set_corners(self, corners: List[Tuple[float, float]]):
        """Initializes homography matrix from 4 image points."""
        if len(corners) != 4:
            raise ValueError(f"Expected 4 corners, got {len(corners)}")
        self.corners = [tuple(c) for c in corners]
        src_pts = np.array(self.corners, dtype=np.float32)
        self.H = cv2.getPerspectiveTransform(src_pts, self.BED_CORNERS)
        self.warning = None

    def load_roi(self) -> bool:
        """Loads 4 corner points from JSON file."""
        if not self.roi_path or not self.roi_path.exists():
            self.H = None
            self.warning = "Run --roi-setup to place insects in 3D"
            return False
        try:
            with open(self.roi_path, "r") as f:
                data = json.load(f)
            if isinstance(data, list) and len(data) == 4:
                self.set_corners(data)
                return True
            else:
                self.warning = "Invalid roi.json (must contain exactly 4 points). Run --roi-setup."
                return False
        except Exception as e:
            self.warning = f"Error reading roi.json: {e}"
            return False

    def save_roi(self, corners: List[Tuple[float, float]]) -> bool:
        """Saves 4 corners to roi.json and re-computes homography."""
        if len(corners) != 4:
            return False
        self.set_corners(corners)
        if self.roi_path:
            self.roi_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.roi_path, "w") as f:
                json.dump([[round(float(c[0]), 2), round(float(c[1]), 2)] for c in corners], f, indent=2)
        return True

    def pixel_to_bed(self, u: float, v: float, clamp_margin: float = 0.05) -> Optional[Dict[str, float]]:
        """
        Maps image pixel coordinates (u, v) to planter bed metric (x, z) coordinates.
        Returns dict {"x": float, "z": float} or None if outside bed.
        """
        if self.H is None:
            return None

        pt = np.array([[[float(u), float(v)]]], dtype=np.float32)
        dst = cv2.perspectiveTransform(pt, self.H)
        x_m, z_m = float(dst[0][0][0]), float(dst[0][0][1])

        # Bounds: Length x in [-1.0, 1.0], Width z in [-0.5, 0.5] with small margin
        if (-1.0 - clamp_margin) <= x_m <= (1.0 + clamp_margin) and (-0.5 - clamp_margin) <= z_m <= (0.5 + clamp_margin):
            return {
                "x": round(max(-1.0, min(1.0, x_m)), 3),
                "z": round(max(-0.5, min(0.5, z_m)), 3),
            }
        return None

    def box_to_bed(self, box: Tuple[int, int, int, int]) -> Optional[Dict[str, float]]:
        """Maps bounding box (x, y, w, h) center to bed metric coordinates."""
        bx, by, bw, bh = box
        cx = bx + (bw / 2.0)
        cy = by + (bh / 2.0)
        return self.pixel_to_bed(cx, cy)
