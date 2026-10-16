"""
Custom OpenCV DNN YOLO Inference & Decoder Engine (Part 2a).

Does NOT require PyTorch or Ultralytics at runtime.
Implements:
1. Letterbox preprocessing with aspect-ratio preservation and padding.
2. Tensor decoding for YOLOv8/v11 output shape: [1, 4 + num_classes, num_anchors]
3. Confidence filtering and Non-Maximum Suppression (cv2.dnn.NMSBoxes).
4. Inverse letterbox coordinate projection back to original pixel dimensions.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np


def letterbox(
    image: np.ndarray,
    target_shape: Tuple[int, int] = (640, 640),
    color: Tuple[int, int, int] = (114, 114, 114),
) -> Tuple[np.ndarray, float, Tuple[int, int]]:
    """
    Resizes image to target_shape while preserving aspect ratio, adding uniform border padding.
    Returns: (letterboxed_image, scale_factor, (pad_left, pad_top))
    """
    h, w = image.shape[:2]
    target_w, target_h = target_shape

    scale = min(target_w / float(w), target_h / float(h))
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))

    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    pad_w = (target_w - new_w) // 2
    pad_h = (target_h - new_h) // 2

    # Pad top, bottom, left, right to exact target_shape
    bottom = target_h - (new_h + pad_h)
    right = target_w - (new_w + pad_w)

    padded = cv2.copyMakeBorder(
        resized, pad_h, bottom, pad_w, right, cv2.BORDER_CONSTANT, value=color
    )
    return padded, scale, (pad_w, pad_h)


def decode_yolo_output(
    output_tensor: np.ndarray,
    scale: float,
    pad: Tuple[int, int],
    orig_shape: Tuple[int, int],
    conf_thresh: float | Dict[int, float] = 0.25,
    nms_thresh: float = 0.45,
) -> List[Tuple[Tuple[int, int, int, int], float, int]]:
    """
    Decodes YOLOv8/YOLO11 output tensor into bounding boxes, confidence scores, and class IDs.
    
    Expected tensor shape: [1, 4 + num_classes, N] or [1, N, 4 + num_classes].
    Returns: List of ((x, y, w, h), confidence, class_id)
    """
    pad_left, pad_top = pad
    orig_h, orig_w = orig_shape

    pred = np.squeeze(output_tensor)
    if pred.ndim == 2 and pred.shape[0] < pred.shape[1]:
        # Shape is [4 + classes, N] -> transpose to [N, 4 + classes]
        pred = pred.T

    if pred.ndim != 2 or pred.shape[1] <= 4:
        return []

    # vectorised: ~50x faster than a Python loop over every anchor
    scores_all = pred[:, 4:]
    class_ids_all = np.argmax(scores_all, axis=1)
    confs_all = scores_all[np.arange(len(pred)), class_ids_all]

    if isinstance(conf_thresh, dict):
        thresh_arr = np.array([conf_thresh.get(int(c), 0.55) for c in class_ids_all], dtype=np.float32)
        keep = confs_all >= thresh_arr
        nms_conf = float(min(conf_thresh.values())) if conf_thresh else 0.25
    else:
        keep = confs_all >= conf_thresh
        nms_conf = float(conf_thresh)

    if not np.any(keep):
        return []

    p = pred[keep]
    cx, cy, bw, bh = p[:, 0], p[:, 1], p[:, 2], p[:, 3]
    x1 = (cx - bw / 2.0 - pad_left) / scale
    y1 = (cy - bh / 2.0 - pad_top) / scale
    x2 = (cx + bw / 2.0 - pad_left) / scale
    y2 = (cy + bh / 2.0 - pad_top) / scale
    x1 = np.clip(x1, 0, orig_w - 1)
    y1 = np.clip(y1, 0, orig_h - 1)
    x2 = np.clip(x2, 0, orig_w)
    y2 = np.clip(y2, 0, orig_h)
    boxes = [
        [int(round(a)), int(round(b)), max(1, int(round(c - a))), max(1, int(round(d - b)))]
        for a, b, c, d in zip(x1, y1, x2, y2)
    ]
    confidences = [float(c) for c in confs_all[keep]]
    class_ids = [int(c) for c in class_ids_all[keep]]

    if not boxes:
        return []

    indices = cv2.dnn.NMSBoxes(boxes, confidences, nms_conf, nms_thresh)
    results = []
    for i in indices:
        idx = int(i[0]) if (hasattr(i, "__getitem__") and not isinstance(i, (np.integer, int))) else int(i)
        results.append((tuple(boxes[idx]), confidences[idx], class_ids[idx]))

    return results


class YOLOOnnxDetector:
    """YOLOv8/v11 ONNX inference engine powered solely by OpenCV DNN."""

    def __init__(
        self,
        onnx_model_path: str,
        input_size: Tuple[int, int] = (640, 640),
        conf_thresh: float = 0.25,
        nms_thresh: float = 0.45,
    ):
        self.model_path = onnx_model_path
        self.input_size = input_size
        self.conf_thresh = conf_thresh
        self.nms_thresh = nms_thresh
        self.net = None
        self.is_loaded = False

        if os.path.exists(onnx_model_path):
            self.load()

    def load(self):
        try:
            self.net = cv2.dnn.readNetFromONNX(self.model_path)
            self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
            self.is_loaded = True
        except Exception as e:
            print(f"[YOLOOnnxDetector] Error loading {self.model_path}: {e}")
            self.is_loaded = False

    def detect(self, image_bgr: np.ndarray) -> List[Tuple[Tuple[int, int, int, int], float, int]]:
        """Executes full forward pass and returns ((x, y, w, h), confidence, class_id)."""
        if not self.is_loaded or self.net is None:
            return []

        orig_shape = image_bgr.shape[:2]
        padded_img, scale, pad = letterbox(image_bgr, target_shape=self.input_size)

        blob = cv2.dnn.blobFromImage(
            padded_img,
            1.0 / 255.0,
            self.input_size,
            swapRB=True,
            crop=False,
        )
        self.net.setInput(blob)
        output = self.net.forward()

        return decode_yolo_output(
            output,
            scale=scale,
            pad=pad,
            orig_shape=orig_shape,
            conf_thresh=self.conf_thresh,
            nms_thresh=self.nms_thresh,
        )
