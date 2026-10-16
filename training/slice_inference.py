"""
Overlapping Slice / Tiling Inference for Tiny Insects (< 12 px) (Part 2a).

Divides 1280x720 frame into overlapping 416x416 or 640x640 crops,
runs detector on each slice, and merges bounding boxes using global coordinates.
"""

from typing import List, Tuple
import cv2
import numpy as np


def slice_image(
    image: np.ndarray,
    slice_size: int = 416,
    overlap: float = 0.2,
) -> List[Tuple[np.ndarray, int, int]]:
    """Yields (crop_img, x_offset, y_offset)."""
    h, w = image.shape[:2]
    step = int(slice_size * (1.0 - overlap))
    slices = []

    for y in range(0, h, step):
        for x in range(0, w, step):
            x1 = min(x, max(0, w - slice_size))
            y1 = min(y, max(0, h - slice_size))
            crop = image[y1 : y1 + slice_size, x1 : x1 + slice_size]
            slices.append((crop, x1, y1))
            if x1 + slice_size >= w:
                break
        if y1 + slice_size >= h:
            break

    return slices
