"""
Crop-Sim Insect Perception Evaluation & Hyperparameter Sweeper Tool.

Features:
- Ingests image folder or video + YOLO-format annotations (<image_name>.txt).
- Evaluates detection performance: Precision, Recall, F1, and mean FP/image at IoU >= 0.3.
- Generates annotated evaluation visuals:
    * Green: True Positive (Hit)
    * Red: False Positive (Spurious / False Alarm)
    * Blue: Missed Ground Truth (False Negative)
- --sweep mode: Grid search over thresholds (area, contrast, N-of-M rule) to find optimal F1 settings.
"""

from __future__ import annotations

import argparse
import itertools
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

# Ensure hardware package is importable
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from hardware.detector import DetectorConfig, InsectDetector, compute_iou


def load_yolo_labels(txt_path: Path, img_w: int, img_h: int) -> List[Tuple[int, int, int, int]]:
    """Loads YOLO format labels (class x_center y_center w h in [0, 1]) and converts to (x, y, w, h) px."""
    boxes = []
    if not txt_path.exists():
        return boxes
    with open(txt_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                # Format: class xc yc w h
                _, xc, yc, bw, bh = map(float, parts[:5])
                w = int(bw * img_w)
                h = int(bh * img_h)
                x = int((xc * img_w) - (w / 2.0))
                y = int((yc * img_h) - (h / 2.0))
                boxes.append((x, y, w, h))
    return boxes


def match_boxes(
    pred_boxes: List[Tuple[int, int, int, int]],
    gt_boxes: List[Tuple[int, int, int, int]],
    iou_thresh: float = 0.3,
) -> Tuple[List[Tuple[int, int, int, int]], List[Tuple[int, int, int, int]], List[Tuple[int, int, int, int]]]:
    """
    Matches predictions to ground truth at IoU >= iou_thresh.
    Returns: (true_positives, false_positives, false_negatives)
    """
    matched_gt = set()
    tp = []
    fp = []

    for pb in pred_boxes:
        best_iou = 0.0
        best_gt_idx = -1
        for g_idx, gb in enumerate(gt_boxes):
            if g_idx in matched_gt:
                continue
            iou = compute_iou(pb, gb)
            if iou > best_iou:
                best_iou = iou
                best_gt_idx = g_idx

        if best_iou >= iou_thresh:
            tp.append(pb)
            matched_gt.add(best_gt_idx)
        else:
            fp.append(pb)

    fn = [gb for g_idx, gb in enumerate(gt_boxes) if g_idx not in matched_gt]
    return tp, fp, fn


def draw_evaluation_frame(
    img: np.ndarray,
    tp: List[Tuple[int, int, int, int]],
    fp: List[Tuple[int, int, int, int]],
    fn: List[Tuple[int, int, int, int]],
) -> np.ndarray:
    """Draws evaluation overlays: Green = TP, Red = FP, Blue = FN (Missed)."""
    vis = img.copy()

    # True Positives (Green)
    for x, y, w, h in tp:
        cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 220, 0), 2)
        cv2.putText(vis, "TP (HIT)", (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 220, 0), 1)

    # False Positives (Red)
    for x, y, w, h in fp:
        cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 0, 255), 2)
        cv2.putText(vis, "FP (FALSE)", (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

    # False Negatives / Missed (Blue)
    for x, y, w, h in fn:
        cv2.rectangle(vis, (x, y), (x + w, y + h), (255, 120, 0), 2)
        cv2.putText(vis, "MISSED GT", (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 120, 0), 1)

    return vis


def evaluate_dataset(
    detector: InsectDetector,
    image_paths: List[Path],
    output_dir: Optional[Path] = None,
    iou_thresh: float = 0.3,
) -> Dict[str, float]:
    """Runs detector over images, compares to YOLO txt labels, and computes metrics."""
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_time_ms = 0.0

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    for img_path in image_paths:
        img = cv2.imread(str(img_path))
        if img is None:
            continue

        h, w = img.shape[:2]
        # Match label file with same stem (.txt)
        txt_path = img_path.with_suffix(".txt")
        gt_boxes = load_yolo_labels(txt_path, w, h)

        t0 = time.perf_counter()
        if detector.config.mode == "motion" or detector.config.mode == "hybrid":
            preds = detector.process(img)
        else:
            preds = detector.detect_image(img)
        elapsed = (time.perf_counter() - t0) * 1000.0
        total_time_ms += elapsed

        tp, fp, fn = match_boxes(preds, gt_boxes, iou_thresh=iou_thresh)
        total_tp += len(tp)
        total_fp += len(fp)
        total_fn += len(fn)

        if output_dir:
            annotated = draw_evaluation_frame(img, tp, fp, fn)
            cv2.imwrite(str(output_dir / f"eval_{img_path.name}"), annotated)

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    f1 = (2.0 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    mean_fp = total_fp / max(1, len(image_paths))
    avg_latency = total_time_ms / max(1, len(image_paths))

    return {
        "images": len(image_paths),
        "tp": total_tp,
        "fp": total_fp,
        "fn": total_fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mean_fp_per_image": mean_fp,
        "avg_latency_ms": avg_latency,
        "fps": 1000.0 / max(0.001, avg_latency),
    }


def run_sweep(image_paths: List[Path], base_config: DetectorConfig) -> None:
    """Performs grid search sweep over detector thresholds and displays ranked F1 leaderboard."""
    print("\n" + "=" * 75)
    print("AI-TO-BOTS / CROP-SIM — HYPERPARAMETER GRID SWEEPER")
    print("=" * 75)

    param_grid = {
        "min_area": [4.0, 8.0, 12.0],
        "min_contrast": [8.0, 12.0, 16.0],
        "min_hits_n": [1, 2],
        "history_window_m": [3, 5],
    }

    keys = list(param_grid.keys())
    combinations = list(itertools.product(*(param_grid[k] for k in keys)))
    print(f"Testing {len(combinations)} parameter configurations on {len(image_paths)} images...\n")

    results = []
    for idx, combo in enumerate(combinations, 1):
        test_config = DetectorConfig(
            mode=base_config.mode,
            target_width=base_config.target_width,
            min_area=combo[0],
            min_contrast=combo[1],
            min_hits_n=combo[2],
            history_window_m=combo[3],
        )
        detector = InsectDetector(test_config)
        metrics = evaluate_dataset(detector, image_paths, output_dir=None)
        results.append((combo, metrics))
        print(f"[{idx:02d}/{len(combinations):02d}] area={combo[0]}, contrast={combo[1]}, n={combo[2]}, m={combo[3]} -> F1: {metrics['f1']:.3f} (P: {metrics['precision']:.3f}, R: {metrics['recall']:.3f}, FP/img: {metrics['mean_fp_per_image']:.2f})")

    # Sort results by F1 score descending
    results.sort(key=lambda r: r[1]["f1"], reverse=True)

    print("\n" + "=" * 75)
    print("TOP 5 OPTIMAL CONFIGURATIONS RANKED BY F1 SCORE")
    print("=" * 75)
    header = f"{'Rank':<5} | {'min_area':<9} | {'contrast':<9} | {'N-of-M':<7} | {'Precision':<10} | {'Recall':<8} | {'F1 Score':<8} | {'FP/img':<7}"
    print(header)
    print("-" * len(header))

    for rank, (combo, m) in enumerate(results[:5], 1):
        nm_str = f"{combo[2]}-of-{combo[3]}"
        print(f"{rank:<5} | {combo[0]:<9.1f} | {combo[1]:<9.1f} | {nm_str:<7} | {m['precision']:<10.3f} | {m['recall']:<8.3f} | {m['f1']:<8.3f} | {m['mean_fp_per_image']:<7.2f}")
    print("=" * 75 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Insect Perception Evaluation Tool")
    parser.add_argument("--data", required=True, help="Directory containing images and YOLO .txt labels")
    parser.add_argument("--detector", default="hybrid", choices=["hybrid", "appearance", "motion", "yolo"])
    parser.add_argument("--output-dir", default="eval_output", help="Directory to save visual validation frames")
    parser.add_argument("--iou", type=float, default=0.3, help="IoU matching threshold (default: 0.3)")
    parser.add_argument("--width", type=int, default=640, help="Evaluation target width")
    parser.add_argument("--sweep", action="store_true", help="Run hyperparameter threshold grid sweep")
    args = parser.parse_args()

    data_dir = Path(args.data)
    if not data_dir.exists():
        sys.exit(f"Error: Dataset directory {data_dir} does not exist.")

    image_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    image_paths = sorted([p for p in data_dir.glob("*") if p.suffix.lower() in image_exts])
    if not image_paths:
        sys.exit(f"Error: No images found in {data_dir}.")

    config = DetectorConfig(mode=args.detector, target_width=args.width)

    if args.sweep:
        run_sweep(image_paths, config)
    else:
        out_dir = Path(args.output_dir)
        detector = InsectDetector(config)
        m = evaluate_dataset(detector, image_paths, output_dir=out_dir, iou_thresh=args.iou)

        print("\n" + "=" * 60)
        print("AI-TO-BOTS / CROP-SIM — EVALUATION REPORT")
        print("=" * 60)
        print(f"Evaluated Images:       {m['images']}")
        print(f"Backend Detector:       {args.detector.upper()}")
        print(f"True Positives (Hits):  {m['tp']}")
        print(f"False Positives:        {m['fp']}")
        print(f"Missed (False Neg):     {m['fn']}")
        print("-" * 60)
        print(f"Precision:              {m['precision']:.4f}")
        print(f"Recall:                 {m['recall']:.4f}")
        print(f"F1 Score:               {m['f1']:.4f}")
        print(f"Mean FP per Image:      {m['mean_fp_per_image']:.2f}")
        print(f"Mean Latency:           {m['avg_latency_ms']:.2f} ms ({m['fps']:.1f} FPS)")
        print(f"Annotated Visuals:      {out_dir.resolve()}")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
