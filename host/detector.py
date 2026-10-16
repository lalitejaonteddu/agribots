"""
AI-to-Bots / Crop-Sim Agricultural Insect Detector.

Features:
- Stage 1: Appearance-based detector (HSV + Lab non-vegetation mask, soil estimation,
           black-hat/top-hat contrast blobs, shape & local contrast filtering, confidence scoring).
           Works on still photos without requiring any motion.
- Stage 2: Hybrid video detector (fuses appearance with MOG2 motion background subtraction,
           centroid/IoU temporal tracking with N-of-M persistence filtering, stationary target persistence).
- Stage 3: Optional YOLOv8/v11 ONNX inference via OpenCV DNN without PyTorch dependency on Raspberry Pi.
- Backward compatibility: InsectDetector.process(frame_bgr) -> list of (x, y, w, h).
"""

from __future__ import annotations

import json
import math
import os
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import cv2
import numpy as np

# COCO 80-class categories to suppress (people, handheld items, furniture, devices)
COCO_SUPPRESS_CLASSES: Set[int] = {
    0,   # person
    24, 25, 26, 27, 28,  # backpack, umbrella, handbag, tie, suitcase
    39, 40, 41, 42, 43, 44, 45, # bottle, wine glass, cup, fork, knife, spoon, bowl
    56, 57, 58, 59, 60,  # chair, couch, potted plant, bed, dining table
    62, 63, 64, 65, 66, 67, # tv, laptop, mouse, remote, keyboard, cell phone
    73, 74, 75, 76,      # book, clock, vase, scissors
}


@dataclass
class DetectorConfig:
    """Consolidated configuration for appearance, motion, hybrid, and YOLO detection."""

    mode: str = "hybrid"  # "appearance", "motion", "hybrid", "yolo"

    # Processing Resolution
    target_width: int = 640  # resize width for real-time performance (e.g. 640x360)

    # Appearance - Vegetation (Green) Rejection
    green_h_low: int = 28
    green_h_high: int = 92
    green_s_low: int = 35
    green_v_low: int = 25
    lab_green_a_thresh: int = 120  # Lab a* values < 120 are distinctly green

    # Appearance - Soil Estimation & Rejection
    soil_estimation_method: str = "median"  # "median" or "kmeans"
    soil_delta_thresh: float = 24.0  # Euclidean distance in Lab color space to consider pixel "soil"

    # Appearance - Blob / Contrast Detection
    morph_kernel_size: int = 5  # Kernel size for black-hat and top-hat morphology
    blackhat_thresh: int = 16  # Dark blobs on lighter soil/foliage
    tophat_thresh: int = 18  # Bright/reflective insects on darker soil
    use_adaptive_thresh: bool = True
    adaptive_block_size: int = 15
    adaptive_c: int = 4
    use_blob_detector: bool = True

    # Candidate Filtering
    min_area: float = 6.0  # Minimum contour area in pixels
    max_area: float = 2500.0  # Maximum contour area in pixels
    min_aspect_ratio: float = 0.2  # Reject needle-thin lines/cracks
    max_aspect_ratio: float = 4.0  # Max aspect ratio (w/h or h/w)
    min_solidity: float = 0.30  # Reject diffuse/fractal leaf boundaries
    min_contrast: float = 10.0  # Local intensity difference against surrounding ring
    pad_merge: int = 6  # Padding for merging overlapping/touching candidate boxes

    # Motion (MOG2) Parameters
    var_threshold: float = 26.0
    learning_rate: float = 0.008
    warmup_frames: int = 18
    history: int = 150

    # Temporal Tracking & Persistence (Hybrid)
    history_window_m: int = 5  # M: sliding window size in frames
    min_hits_n: int = 2  # N: minimum detections required within last M frames
    max_missed_frames: int = 12  # Keep track alive when stationary (avoids MOG2 drop)
    max_match_dist: float = 45.0  # Maximum centroid distance (px) for frame-to-frame association
    min_iou: float = 0.05

    # YOLO / ONNX Configuration
    onnx_model_path: str = ""
    yolo_conf_thresh: float = 0.25
    yolo_nms_thresh: float = 0.45
    yolo_input_size: Tuple[int, int] = (416, 416)
    per_class_conf: Dict[int, float] = field(default_factory=lambda: {0: 0.55, 1: 0.55, 2: 0.55, 3: 0.55})
    thresholds_path: str = "models/thresholds.json"
    classes_path: str = "models/classes.txt"
    yolo_class_names: Tuple[str, ...] = (
        "fall_armyworm_moth",
        "spodoptera_litura_moth",
        "spodoptera_exigua_moth",
        "locust",
    )

    # Runtime Sanity Filters (Part A)
    max_box_frac: float = 0.015  # Reject boxes > 1.5% of total frame area (insects are << 1%)
    min_box_side: int = 6        # Reject boxes with shorter side < 6 px
    
    # Person / Object Gate (COCO YOLOv8n)
    coco_model_path: str = "models/coco_yolov8n.onnx"
    coco_conf_thresh: float = 0.35
    coco_cadence: int = 3        # Run COCO inference every 3rd frame
    person_pause_area_frac: float = 0.20 # Pause triggering if a person covers > 20% of frame

    # Region of Interest (ROI)
    roi_path: str = "host/roi.json"
    roi_polygon: Optional[List[Tuple[int, int]]] = None

    # Stronger Temporal Rule for YOLO
    yolo_history_window_m: int = 6  # Look back across 6 frames
    yolo_min_hits_n: int = 4        # Require at least 4 detections
    yolo_min_mean_conf: float = 0.50 # Mean confidence threshold across hit frames

    # Diagnostics & Debug
    measure_timing: bool = True
    debug: bool = False


def box_passes_sanity(
    box: Tuple[int, int, int, int],
    frame_shape: Tuple[int, int],
    max_box_frac: float = 0.04,
    min_box_side: int = 6,
    max_aspect_ratio: float = 4.0,
) -> bool:
    """Rejects boxes that are too large (hands/people), sub-pixel noise, or elongated edges."""
    x, y, w, h = box
    if w <= 0 or h <= 0:
        return False
    frame_h, frame_w = frame_shape[:2]
    frame_area = float(frame_w * frame_h)
    box_area = float(w * h)
    if frame_area > 0 and (box_area / frame_area) > max_box_frac:
        return False
    if min(w, h) < min_box_side:
        return False
    aspect = max(float(w) / float(h), float(h) / float(w))
    if aspect > max_aspect_ratio:
        return False
    return True


def box_center_in_roi(
    box: Tuple[int, int, int, int],
    roi_polygon: Optional[List[Tuple[int, int]]],
) -> bool:
    """Returns True if the box centroid falls within the calibrated ROI polygon (or if none is set)."""
    if not roi_polygon or len(roi_polygon) < 3:
        return True
    cx = box[0] + box[2] / 2.0
    cy = box[1] + box[3] / 2.0
    poly_arr = np.array(roi_polygon, dtype=np.int32).reshape((-1, 1, 2))
    dist = cv2.pointPolygonTest(poly_arr, (float(cx), float(cy)), False)
    return dist >= 0


class TrackedTarget:
    """Maintains identity, kinematics, and temporal hit & confidence history for an insect candidate."""

    _next_id = 1

    def __init__(self, box: Tuple[int, int, int, int], confidence: float, window_size: int = 5):
        self.track_id = TrackedTarget._next_id
        TrackedTarget._next_id += 1
        self.box = box  # (x, y, w, h)
        self.confidence = confidence
        self.history = deque([True], maxlen=window_size)
        self.conf_history = deque([confidence], maxlen=window_size)
        self.missed_frames = 0
        self.total_hits = 1
        self.last_update = time.time()

    @property
    def centroid(self) -> Tuple[float, float]:
        x, y, w, h = self.box
        return (x + w / 2.0, y + h / 2.0)

    @property
    def mean_confidence(self) -> float:
        return float(np.mean(self.conf_history)) if self.conf_history else float(self.confidence)

    def update(self, box: Tuple[int, int, int, int], confidence: float):
        self.box = box
        self.confidence = max(self.confidence * 0.8, confidence)
        self.history.append(True)
        self.conf_history.append(confidence)
        self.missed_frames = 0
        self.total_hits += 1
        self.last_update = time.time()

    def mark_missed(self):
        self.history.append(False)
        self.missed_frames += 1

    def is_confirmed(self, min_hits: int, min_mean_conf: Optional[float] = None) -> bool:
        if sum(self.history) < min_hits:
            return False
        if min_mean_conf is not None and self.mean_confidence < min_mean_conf:
            return False
        return True


def compute_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
    """Computes Intersection-over-Union between two (x, y, w, h) bounding boxes."""
    ax, ay, aw, ah = boxA
    bx, by, bw, bh = boxB
    x1 = max(ax, bx)
    y1 = max(ay, by)
    x2 = min(ax + aw, bx + bw)
    y2 = min(ay + ah, by + bh)

    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter_area = inter_w * inter_h
    if inter_area <= 0:
        return 0.0

    union_area = (aw * ah) + (bw * bh) - inter_area
    return float(inter_area) / float(union_area) if union_area > 0 else 0.0


def merge_boxes(boxes: List[Tuple[int, int, int, int]], pad: int = 6) -> List[Tuple[int, int, int, int]]:
    """Joins overlapping or touching bounding boxes (e.g. insect body + wings)."""
    if not boxes:
        return []
    box_list = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        for i in range(len(box_list)):
            for j in range(i + 1, len(box_list)):
                ax, ay, aw, ah = box_list[i]
                bx, by, bw, bh = box_list[j]
                if (
                    ax - pad < bx + bw
                    and bx - pad < ax + aw
                    and ay - pad < by + bh
                    and by - pad < ay + ah
                ):
                    x = min(ax, bx)
                    y = min(ay, by)
                    w = max(ax + aw, bx + bw) - x
                    h = max(ay + ah, by + bh) - y
                    box_list[i] = [x, y, w, h]
                    del box_list[j]
                    changed = True
                    break
            if changed:
                break
    return [tuple(b) for b in box_list]


class InsectDetector:
    """
    Multi-stage Agricultural Insect Perception Engine.
    
    Compatible with Raspberry Pi hardware rig and desktop simulation.
    """

    def __init__(self, config: Optional[DetectorConfig] = None, **kwargs):
        self.config = config or DetectorConfig()
        # Override with kwargs if supplied
        for k, v in kwargs.items():
            if hasattr(self.config, k):
                setattr(self.config, k, v)

        # Morphological structuring elements
        k_size = self.config.morph_kernel_size
        self.k_morph = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
        self.k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        self.k_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4))

        # Motion background subtractor
        self.mog = cv2.createBackgroundSubtractorMOG2(
            history=self.config.history,
            varThreshold=self.config.var_threshold,
            detectShadows=False,
        )

        # SimpleBlobDetector configuration
        blob_params = cv2.SimpleBlobDetector_Params()
        blob_params.filterByArea = True
        blob_params.minArea = float(self.config.min_area)
        blob_params.maxArea = float(self.config.max_area)
        blob_params.filterByCircularity = False
        blob_params.filterByConvexity = False
        blob_params.filterByInertia = True
        blob_params.minInertiaRatio = 0.15
        self.blob_detector = cv2.SimpleBlobDetector_create(blob_params)

        # Load dynamic class names if classes.txt exists
        if self.config.classes_path and os.path.exists(self.config.classes_path):
            try:
                with open(self.config.classes_path, "r") as f:
                    cnames = [line.strip() for line in f if line.strip()]
                    if cnames:
                        self.config.yolo_class_names = tuple(cnames)
            except Exception as e:
                print(f"[InsectDetector] Warning loading {self.config.classes_path}: {e}")

        # Load per-class thresholds from JSON if exists
        if self.config.thresholds_path and os.path.exists(self.config.thresholds_path):
            try:
                with open(self.config.thresholds_path, "r") as f:
                    th_data = json.load(f)
                    if isinstance(th_data, dict):
                        for k, v in th_data.items():
                            try:
                                self.config.per_class_conf[int(k)] = float(v)
                            except ValueError:
                                if k in self.config.yolo_class_names:
                                    idx = self.config.yolo_class_names.index(k)
                                    self.config.per_class_conf[idx] = float(v)
            except Exception as e:
                print(f"[InsectDetector] Warning loading {self.config.thresholds_path}: {e}")

        # Load ROI if exists
        if self.config.roi_path and os.path.exists(self.config.roi_path):
            try:
                with open(self.config.roi_path, "r") as f:
                    roi_data = json.load(f)
                    if isinstance(roi_data, list) and len(roi_data) >= 3:
                        self.config.roi_polygon = [tuple(pt) for pt in roi_data]
            except Exception as e:
                print(f"[InsectDetector] Warning loading {self.config.roi_path}: {e}")

        # ONNX YOLO Net
        self.yolo_net = None
        if self.config.onnx_model_path and os.path.exists(self.config.onnx_model_path):
            self._init_yolo_net(self.config.onnx_model_path)

        # COCO Net for Person / Object Gating
        self.coco_net = None
        self.last_coco_boxes: List[Tuple[Tuple[int, int, int, int], float, int]] = []
        self.person_in_view = False
        if self.config.coco_model_path and os.path.exists(self.config.coco_model_path):
            try:
                self.coco_net = cv2.dnn.readNetFromONNX(self.config.coco_model_path)
                self.coco_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self.coco_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
            except Exception as e:
                print(f"[InsectDetector] Warning loading COCO model {self.config.coco_model_path}: {e}")
                self.coco_net = None

        # State & Tracking
        self.frame_count = 0
        self.tracks: List[TrackedTarget] = []
        self.last_soil_color_lab: Optional[np.ndarray] = None

        # Timing metrics
        self.timings: Dict[str, float] = {
            "motion_ms": 0.0,
            "appearance_ms": 0.0,
            "tracking_ms": 0.0,
            "total_ms": 0.0,
            "fps": 0.0,
        }

    def _init_yolo_net(self, model_path: str):
        try:
            self.yolo_net = cv2.dnn.readNetFromONNX(model_path)
            self.yolo_net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            self.yolo_net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        except Exception as e:
            print(f"[InsectDetector] Warning: Could not load ONNX model ({e}). Fallback to hybrid.")
            self.yolo_net = None

    def reset(self):
        """Resets tracker and background subtractor state."""
        self.frame_count = 0
        self.tracks.clear()
        self.mog = cv2.createBackgroundSubtractorMOG2(
            history=self.config.history,
            varThreshold=self.config.var_threshold,
            detectShadows=False,
        )
        self.last_soil_color_lab = None

    # -------------------------------------------------------------------------
    # STAGE 1: APPEARANCE-BASED DETECTOR (Still Photos + Video)
    # -------------------------------------------------------------------------

    def detect_appearance(
        self, frame_bgr: np.ndarray
    ) -> List[Tuple[Tuple[int, int, int, int], float]]:
        """
        Detects insect candidates in a single frame using color, morphology, and local contrast.
        Returns list of ((x, y, w, h), confidence_score).
        """
        h, w = frame_bgr.shape[:2]
        blur = cv2.GaussianBlur(frame_bgr, (3, 3), 0)
        hsv = cv2.cvtColor(blur, cv2.COLOR_BGR2HSV)
        lab = cv2.cvtColor(blur, cv2.COLOR_BGR2Lab)
        gray = cv2.cvtColor(blur, cv2.COLOR_BGR2GRAY)

        # 1. Non-Vegetation Mask (Exclude Green Leaves)
        green_hsv = cv2.inRange(
            hsv,
            (self.config.green_h_low, self.config.green_s_low, self.config.green_v_low),
            (self.config.green_h_high, 255, 255),
        )
        # Lab a* channel threshold (green foliage has low a*)
        lab_a = lab[:, :, 1]
        green_lab = (lab_a < self.config.lab_green_a_thresh).astype(np.uint8) * 255
        is_green = cv2.bitwise_or(green_hsv, green_lab)
        not_green = cv2.bitwise_not(is_green)

        # 2. Non-Soil Mask (Exclude Background Soil)
        # Estimate dominant background soil color from non-green pixels
        non_green_indices = np.where(not_green > 0)
        if len(non_green_indices[0]) > 200:
            sample_lab = lab[non_green_indices]
            if self.config.soil_estimation_method == "kmeans" and len(sample_lab) > 1000:
                # Subsample for speed
                step = max(1, len(sample_lab) // 500)
                sub_pts = sample_lab[::step].astype(np.float32)
                criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 5, 1.0)
                _, _, centers = cv2.kmeans(sub_pts, 2, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
                # Primary soil cluster
                soil_color = centers[0]
            else:
                soil_color = np.median(sample_lab, axis=0)
            self.last_soil_color_lab = soil_color
        else:
            soil_color = (
                self.last_soil_color_lab
                if self.last_soil_color_lab is not None
                else np.array([80.0, 135.0, 140.0])
            )

        # Delta E distance to dominant soil in Lab space
        diff_l = lab[:, :, 0].astype(np.float32) - soil_color[0]
        diff_a = lab[:, :, 1].astype(np.float32) - soil_color[1]
        diff_b = lab[:, :, 2].astype(np.float32) - soil_color[2]
        dist_soil = np.sqrt(diff_l * diff_l + diff_a * diff_a + diff_b * diff_b)
        not_soil = (dist_soil > self.config.soil_delta_thresh).astype(np.uint8) * 255

        # Combined valid region: neither leaf nor soil
        search_region = cv2.bitwise_and(not_green, not_soil)

        # 3. High-Contrast Blob Extraction via Black-Hat & Top-Hat Morphology
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, self.k_morph)
        tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, self.k_morph)

        _, mask_dark = cv2.threshold(blackhat, self.config.blackhat_thresh, 255, cv2.THRESH_BINARY)
        _, mask_light = cv2.threshold(tophat, self.config.tophat_thresh, 255, cv2.THRESH_BINARY)
        morph_blobs = cv2.bitwise_or(mask_dark, mask_light)

        # Optional adaptive threshold for subtle edges
        if self.config.use_adaptive_thresh:
            block = self.config.adaptive_block_size
            if block % 2 == 0:
                block += 1
            ad_dark = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, block, self.config.adaptive_c
            )
            # Filter adaptive by search region
            morph_blobs = cv2.bitwise_or(morph_blobs, cv2.bitwise_and(ad_dark, search_region))

        # Restrict candidate blobs to non-leaf, non-soil regions
        candidate_mask = cv2.bitwise_and(morph_blobs, search_region)
        candidate_mask = cv2.morphologyEx(candidate_mask, cv2.MORPH_OPEN, self.k_open)
        candidate_mask = cv2.dilate(candidate_mask, self.k_dilate)

        # 4. Extract Candidate Contours and Shape/Color/Contrast Filtering
        contours, _ = cv2.findContours(candidate_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates: List[Tuple[Tuple[int, int, int, int], float]] = []

        for c in contours:
            area = cv2.contourArea(c)
            if not (self.config.min_area <= area <= self.config.max_area):
                continue

            bx, by, bw, bh = cv2.boundingRect(c)
            aspect_ratio = float(bw) / float(max(1, bh))
            if not (self.config.min_aspect_ratio <= aspect_ratio <= self.config.max_aspect_ratio):
                continue

            hull = cv2.convexHull(c)
            hull_area = cv2.contourArea(hull)
            solidity = float(area) / float(max(1.0, hull_area))
            if solidity < self.config.min_solidity:
                continue

            # Check interior color (ensure not predominantly green foliage)
            box_hsv = hsv[by : by + bh, bx : bx + bw]
            if box_hsv.size == 0:
                continue
            mean_h = np.mean(box_hsv[:, :, 0])
            mean_s = np.mean(box_hsv[:, :, 1])
            if (
                self.config.green_h_low <= mean_h <= self.config.green_h_high
                and mean_s > self.config.green_s_low + 10
            ):
                continue

            # Local Contrast Calculation: Inner Box vs. Outer Halo
            pad = 4
            x1 = max(0, bx - pad)
            y1 = max(0, by - pad)
            x2 = min(w, bx + bw + pad)
            y2 = min(h, by + bh + pad)

            inner_patch = gray[by : by + bh, bx : bx + bw]
            outer_patch = gray[y1:y2, x1:x2]

            mean_inner = float(np.mean(inner_patch))
            # Calculate outer border intensity excluding the inner region
            sum_outer = float(np.sum(outer_patch)) - float(np.sum(inner_patch))
            outer_count = max(1, outer_patch.size - inner_patch.size)
            mean_outer = sum_outer / float(outer_count)

            local_contrast = abs(mean_inner - mean_outer)
            if local_contrast < self.config.min_contrast:
                continue

            # Confidence score calculation [0.0 - 1.0]
            contrast_score = min(1.0, local_contrast / 40.0)
            solidity_score = min(1.0, solidity)
            dist_score = min(1.0, np.mean(dist_soil[by : by + bh, bx : bx + bw]) / 60.0)
            confidence = float(0.4 * contrast_score + 0.3 * solidity_score + 0.3 * dist_score)

            candidates.append(((bx, by, bw, bh), round(confidence, 3)))

        # 5. Optional SimpleBlobDetector Candidates
        if self.config.use_blob_detector:
            keypoints = self.blob_detector.detect(gray)
            for kp in keypoints:
                kx, ky = int(kp.pt[0]), int(kp.pt[1])
                kr = max(3, int(kp.size / 2.0))
                bx = max(0, kx - kr)
                by = max(0, ky - kr)
                bw = min(w - bx, kr * 2)
                bh = min(h - by, kr * 2)
                if not_green[min(h - 1, ky), min(w - 1, kx)] > 0:
                    candidates.append(((bx, by, bw, bh), 0.65))

        # Merge touching candidates
        raw_boxes = [c[0] for c in candidates]
        merged_boxes = merge_boxes(raw_boxes, pad=self.config.pad_merge)

        # Assign best confidence to merged boxes
        result: List[Tuple[Tuple[int, int, int, int], float]] = []
        for mb in merged_boxes:
            best_conf = 0.5
            for cb, conf in candidates:
                if compute_iou(mb, cb) > 0.05:
                    best_conf = max(best_conf, conf)
            result.append((mb, best_conf))

        return result

    def detect_image(self, img_bgr: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Public still-photo detection method.
        Returns a list of (x, y, w, h) bounding boxes.
        """
        t0 = time.perf_counter()
        # Scale to standard target width if required
        h0, w0 = img_bgr.shape[:2]
        if self.config.target_width and w0 != self.config.target_width:
            scale = self.config.target_width / float(w0)
            target_h = int(h0 * scale)
            resized = cv2.resize(img_bgr, (self.config.target_width, target_h))
            inv_scale = 1.0 / scale
        else:
            resized = img_bgr
            inv_scale = 1.0

        if self.config.mode == "yolo" and self.yolo_net:
            raw_detections = self.detect_yolo(resized)
        else:
            raw_detections = self.detect_appearance(resized)

        # Scale coordinates back to original image dimensions
        final_boxes: List[Tuple[int, int, int, int]] = []
        for (x, y, w, h), _ in raw_detections:
            if inv_scale != 1.0:
                final_boxes.append((int(x * inv_scale), int(y * inv_scale), int(w * inv_scale), int(h * inv_scale)))
            else:
                final_boxes.append((x, y, w, h))

        if self.config.mode == "yolo":
            self.last_yolo_full = [
                (tuple(int(v * inv_scale) for v in box), conf, cls) for box, conf, cls in getattr(self, "last_yolo", [])
            ]

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        self.timings["appearance_ms"] = elapsed_ms
        self.timings["total_ms"] = elapsed_ms
        self.timings["fps"] = 1000.0 / max(0.001, elapsed_ms)
        return final_boxes

    # -------------------------------------------------------------------------
    # STAGE 2: HYBRID VIDEO DETECTOR (Motion + Appearance + Tracking)
    # -------------------------------------------------------------------------

    def detect_motion(self, frame_bgr: np.ndarray) -> List[Tuple[Tuple[int, int, int, int], float]]:
        """Computes MOG2 background subtraction motion candidates."""
        blur = cv2.GaussianBlur(frame_bgr, (3, 3), 0)
        lr = 0.25 if self.frame_count < self.config.warmup_frames else self.config.learning_rate
        fg = self.mog.apply(blur, learningRate=lr)

        hsv = cv2.cvtColor(blur, cv2.COLOR_BGR2HSV)
        green = cv2.inRange(
            hsv,
            (self.config.green_h_low, self.config.green_s_low, self.config.green_v_low),
            (self.config.green_h_high, 255, 255),
        )
        mask = cv2.bitwise_and(fg, cv2.bitwise_not(green))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.k_open)
        mask = cv2.dilate(mask, self.k_dilate)
        self.last_mask = mask  # shown by the host's [M] key

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = []
        for c in contours:
            area = cv2.contourArea(c)
            if self.config.min_area <= area <= self.config.max_area:
                bx, by, bw, bh = cv2.boundingRect(c)
                boxes.append(((bx, by, bw, bh), 0.8))
        return boxes

    def detect_coco(self, frame_bgr: np.ndarray) -> List[Tuple[Tuple[int, int, int, int], float, int]]:
        """Runs the standard COCO YOLOv8n ONNX to detect people, furniture, and room objects."""
        if not self.coco_net:
            return []
        try:
            from yolo_onnx import letterbox, decode_yolo_output
        except ImportError:
            from host.yolo_onnx import letterbox, decode_yolo_output

        orig_shape = frame_bgr.shape[:2]
        padded, scale, pad = letterbox(frame_bgr, target_shape=(416, 416))
        blob = cv2.dnn.blobFromImage(padded, 1.0 / 255.0, (416, 416), swapRB=True, crop=False)
        self.coco_net.setInput(blob)
        outputs = self.coco_net.forward()
        dets = decode_yolo_output(
            outputs,
            scale=scale,
            pad=pad,
            orig_shape=orig_shape,
            conf_thresh=self.config.coco_conf_thresh,
            nms_thresh=0.45,
        )
        return dets

    def detect_yolo(self, frame_bgr: np.ndarray) -> List[Tuple[Tuple[int, int, int, int], float]]:
        """YOLO ONNX with size sanity, ROI filtering, and COCO person/object gating."""
        if not self.yolo_net:
            return []
        try:
            from yolo_onnx import letterbox, decode_yolo_output
        except ImportError:
            from host.yolo_onnx import letterbox, decode_yolo_output

        orig_shape = frame_bgr.shape[:2]
        frame_h, frame_w = orig_shape
        frame_area = float(frame_h * frame_w)

        # 1. Periodically run COCO detector (every coco_cadence frames)
        if self.coco_net and (self.frame_count % max(1, self.config.coco_cadence) == 0 or not self.last_coco_boxes):
            self.last_coco_boxes = self.detect_coco(frame_bgr)
            person_boxes = [box for box, conf, cls_id in self.last_coco_boxes if cls_id == 0]
            max_person_area = max([b[2] * b[3] for b in person_boxes], default=0.0)
            self.person_in_view = (max_person_area / frame_area) > self.config.person_pause_area_frac

        padded, scale, pad = letterbox(frame_bgr, target_shape=self.config.yolo_input_size)
        blob = cv2.dnn.blobFromImage(padded, 1.0 / 255.0, self.config.yolo_input_size, swapRB=True, crop=False)
        self.yolo_net.setInput(blob)
        outputs = self.yolo_net.forward()

        # Pass per_class_conf dict or fallback threshold
        conf_param = self.config.per_class_conf if self.config.per_class_conf else self.config.yolo_conf_thresh
        dets = decode_yolo_output(
            outputs,
            scale=scale,
            pad=pad,
            orig_shape=orig_shape,
            conf_thresh=conf_param,
            nms_thresh=self.config.yolo_nms_thresh,
        )

        filtered_dets = []
        for box, conf, cls_id in dets:
            # 1. Box-size & aspect-ratio sanity filter
            if not box_passes_sanity(
                box,
                orig_shape,
                max_box_frac=self.config.max_box_frac,
                min_box_side=self.config.min_box_side,
                max_aspect_ratio=self.config.max_aspect_ratio,
            ):
                continue

            # 2. ROI polygon filter
            if not box_center_in_roi(box, self.config.roi_polygon):
                continue

            # 3. Person / Object gate: drop insect box if it overlaps any COCO suppressor box
            if self.last_coco_boxes:
                bx, by, bw, bh = box
                bcx, bcy = bx + bw / 2.0, by + bh / 2.0
                suppressed = False
                for c_box, c_conf, c_cls in self.last_coco_boxes:
                    if c_cls in COCO_SUPPRESS_CLASSES:
                        c_x, c_y, c_w, c_h = c_box
                        # Center inside COCO box
                        if (c_x <= bcx <= c_x + c_w) and (c_y <= bcy <= c_y + c_h):
                            suppressed = True
                            break
                        # Overlap IoU > 0.1
                        if compute_iou(box, c_box) > 0.10:
                            suppressed = True
                            break
                if suppressed:
                    continue

            filtered_dets.append((box, conf, cls_id))

        self.last_yolo = filtered_dets
        return [(box, conf) for box, conf, _cls in filtered_dets]

    def class_name(self, class_id: int) -> str:
        names = self.config.yolo_class_names
        return names[class_id] if 0 <= class_id < len(names) else f"class_{class_id}"

    def describe(self, boxes: List[Tuple[int, int, int, int]]) -> List[Tuple[str, float]]:
        """Label + confidence for each confirmed box (YOLO: best-overlapping raw detection; else 'insect')."""
        out = []
        raw = getattr(self, "last_yolo_full", [])
        for b in boxes:
            best, best_iou = None, 0.0
            for box, conf, cls in raw:
                iou = compute_iou(b, box)
                if iou > best_iou:
                    best, best_iou = (self.class_name(cls), conf), iou
            out.append(best if best and best_iou > 0.1 else ("insect", 0.0))
        return out

    def _update_tracker(
        self, candidates: List[Tuple[Tuple[int, int, int, int], float]]
    ) -> List[Tuple[int, int, int, int]]:
        """Associates detections across consecutive frames to reject flicker and preserve stationary targets."""
        matched_track_indices = set()
        matched_cand_indices = set()

        # Match existing tracks to new candidates via IoU and centroid distance
        for t_idx, track in enumerate(self.tracks):
            best_score = -1.0
            best_c_idx = -1
            tc_x, tc_y = track.centroid

            for c_idx, (box, conf) in enumerate(candidates):
                if c_idx in matched_cand_indices:
                    continue
                iou = compute_iou(track.box, box)
                cx, cy, cw, ch = box
                c_center_x, c_center_y = cx + cw / 2.0, cy + ch / 2.0
                dist = math.hypot(tc_x - c_center_x, tc_y - c_center_y)

                if iou >= self.config.min_iou or dist <= self.config.max_match_dist:
                    score = iou * 2.0 + (1.0 - min(1.0, dist / self.config.max_match_dist))
                    if score > best_score:
                        best_score = score
                        best_c_idx = c_idx

            if best_c_idx >= 0:
                matched_track_indices.add(t_idx)
                matched_cand_indices.add(best_c_idx)
                cand_box, cand_conf = candidates[best_c_idx]
                track.update(cand_box, cand_conf)

        # Unmatched tracks get marked as missed
        for t_idx, track in enumerate(self.tracks):
            if t_idx not in matched_track_indices:
                track.mark_missed()

        # Unmatched candidates spawn new tracks with appropriate window size
        is_yolo = (self.config.mode == "yolo")
        win_size = self.config.yolo_history_window_m if is_yolo else self.config.history_window_m
        for c_idx, (cand_box, cand_conf) in enumerate(candidates):
            if c_idx not in matched_cand_indices:
                self.tracks.append(
                    TrackedTarget(
                        cand_box, cand_conf, window_size=win_size
                    )
                )

        # Prune dead tracks
        self.tracks = [
            t for t in self.tracks if t.missed_frames <= self.config.max_missed_frames
        ]

        # Filter confirmed tracks meeting the N-of-M persistence requirement
        min_hits = self.config.yolo_min_hits_n if is_yolo else self.config.min_hits_n
        min_conf = self.config.yolo_min_mean_conf if is_yolo else None
        confirmed_boxes = [
            t.box for t in self.tracks if t.is_confirmed(min_hits, min_mean_conf=min_conf)
        ]
        return merge_boxes(confirmed_boxes, pad=self.config.pad_merge)

    def get_confirmed_tracks(self) -> List[Tuple[int, Tuple[int, int, int, int], float]]:
        """Returns list of (track_id, box, confidence) for all currently confirmed tracks."""
        is_yolo = (self.config.mode == "yolo")
        min_hits = self.config.yolo_min_hits_n if is_yolo else self.config.min_hits_n
        min_conf = self.config.yolo_min_mean_conf if is_yolo else None
        return [
            (t.track_id, t.box, t.mean_confidence)
            for t in self.tracks
            if t.is_confirmed(min_hits, min_mean_conf=min_conf)
        ]

    def process(self, frame_bgr: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Primary video frame processing entrypoint.
        
        Signature matching the physical rig & server.py:
            process(frame_bgr) -> list of (x, y, w, h)
        """
        t0 = time.perf_counter()
        self.frame_count += 1
        h0, w0 = frame_bgr.shape[:2]

        # Resolution scaling
        if self.config.target_width and w0 != self.config.target_width:
            scale = self.config.target_width / float(w0)
            target_h = int(h0 * scale)
            resized = cv2.resize(frame_bgr, (self.config.target_width, target_h))
            inv_scale = 1.0 / scale
        else:
            resized = frame_bgr
            inv_scale = 1.0

        candidates: List[Tuple[Tuple[int, int, int, int], float]] = []

        if self.config.mode == "motion":
            # Pure legacy MOG2 motion
            t_m0 = time.perf_counter()
            motion_cands = self.detect_motion(resized)
            self.timings["motion_ms"] = (time.perf_counter() - t_m0) * 1000.0
            if self.frame_count > self.config.warmup_frames:
                candidates.extend(motion_cands)

        elif self.config.mode == "appearance":
            # Pure appearance (from frame 1)
            t_a0 = time.perf_counter()
            app_cands = self.detect_appearance(resized)
            self.timings["appearance_ms"] = (time.perf_counter() - t_a0) * 1000.0
            candidates.extend(app_cands)

        elif self.config.mode == "yolo" and self.yolo_net:
            # YOLO DNN
            t_y0 = time.perf_counter()
            candidates.extend(self.detect_yolo(resized))
            self.timings["total_ms"] = (time.perf_counter() - t_y0) * 1000.0

        else:
            # HYBRID MODE: Appearance (from frame 1) + Motion (after warmup)
            t_a0 = time.perf_counter()
            app_cands = self.detect_appearance(resized)
            self.timings["appearance_ms"] = (time.perf_counter() - t_a0) * 1000.0

            t_m0 = time.perf_counter()
            motion_cands = self.detect_motion(resized)
            self.timings["motion_ms"] = (time.perf_counter() - t_m0) * 1000.0

            # Fused candidate pooling
            candidates.extend(app_cands)
            if self.frame_count > self.config.warmup_frames:
                for mc in motion_cands:
                    # Check if motion already covered by appearance
                    already_covered = any(compute_iou(mc[0], ac[0]) > 0.3 for ac in app_cands)
                    if not already_covered:
                        candidates.append(mc)

        # Temporal Tracking & N-of-M persistence
        t_tr0 = time.perf_counter()
        confirmed_boxes = self._update_tracker(candidates)
        self.timings["tracking_ms"] = (time.perf_counter() - t_tr0) * 1000.0

        # keep YOLO labels in full-frame coordinates for describe()
        if self.config.mode == "yolo":
            self.last_yolo_full = [
                (tuple(int(v * inv_scale) for v in box), conf, cls) for box, conf, cls in getattr(self, "last_yolo", [])
            ]

        # Rescale boxes back to original coordinate space
        final_boxes: List[Tuple[int, int, int, int]] = []
        for x, y, w, h in confirmed_boxes:
            if inv_scale != 1.0:
                final_boxes.append((int(x * inv_scale), int(y * inv_scale), int(w * inv_scale), int(h * inv_scale)))
            else:
                final_boxes.append((x, y, w, h))

        total_elapsed = (time.perf_counter() - t0) * 1000.0
        self.timings["total_ms"] = total_elapsed
        self.timings["fps"] = 1000.0 / max(0.001, total_elapsed)
        return final_boxes

    def get_timing_stats(self) -> Dict[str, float]:
        """Returns the latest latency (ms) and processing frame rate."""
        return dict(self.timings)
