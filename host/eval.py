"""
Crop-Sim Insect Perception Evaluation & Benchmark Tool (Part 2c).

Evaluates detectors against ground-truth YOLO labels:
- Matches predicted bounding boxes to ground truth at IoU >= 0.3.
- Reports Precision, Recall, F1, False Positives per Image, and Average Latency (ms) / FPS.
- Formats comparison across all requested detectors into a unified summary table.
- Saves annotated verification frames to eval_out/ (Green: Hit, Red: False Alarm, Blue: Missed).
- --sweep: Runs grid search over hybrid and YOLO thresholds to find best F1 score.
"""

from __future__ import annotations

import argparse
import itertools
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

HOST_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(HOST_DIR))

from detector import DetectorConfig, InsectDetector, compute_iou


def load_yolo_labels(txt_path: Path, img_w: int, img_h: int) -> List[Tuple[int, int, int, int]]:
    """Loads YOLO format labels (class x_center y_center w h in [0, 1]) into (x, y, w, h) px."""
    boxes = []
    if not txt_path.exists():
        return boxes
    with open(txt_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                _, xc, yc, bw, bh = map(float, parts[:5])
                w = int(bw * img_w)
                h = int(bh * img_h)
                x = int((xc * img_w) - (w / 2.0))
                y = int((yc * img_h) - (h / 2.0))
                boxes.append((x, y, w, h))
    return boxes


def load_yolo_labels_with_cls(txt_path: Path, img_w: int, img_h: int) -> List[Tuple[int, Tuple[int, int, int, int]]]:
    """Loads YOLO format labels into list of (class_id, (x, y, w, h))."""
    items = []
    if not txt_path.exists():
        return items
    with open(txt_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 5:
                cid = int(parts[0])
                _, xc, yc, bw, bh = map(float, parts[:5])
                w = int(bw * img_w)
                h = int(bh * img_h)
                x = int((xc * img_w) - (w / 2.0))
                y = int((yc * img_h) - (h / 2.0))
                items.append((cid, (x, y, w, h)))
    return items


def match_boxes(
    pred_boxes: List[Tuple[int, int, int, int]],
    gt_boxes: List[Tuple[int, int, int, int]],
    iou_thresh: float = 0.3,
) -> Tuple[List[Tuple[int, int, int, int]], List[Tuple[int, int, int, int]], List[Tuple[int, int, int, int]]]:
    """Matches predictions with ground truth boxes at IoU >= 0.3."""
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


def draw_eval_frame(
    img: np.ndarray,
    tp: List[Tuple[int, int, int, int]],
    fp: List[Tuple[int, int, int, int]],
    fn: List[Tuple[int, int, int, int]],
) -> np.ndarray:
    """Draws evaluation overlays (Green = Hit, Red = False Alarm, Blue = Missed Ground Truth)."""
    vis = img.copy()

    for x, y, w, h in tp:
        cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 220, 0), 2)
        cv2.putText(vis, "HIT", (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 0), 1)

    for x, y, w, h in fp:
        cv2.rectangle(vis, (x, y), (x + w, y + h), (0, 0, 255), 2)
        cv2.putText(vis, "FALSE ALARM", (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 255), 1)

    for x, y, w, h in fn:
        cv2.rectangle(vis, (x, y), (x + w, y + h), (255, 120, 0), 2)
        cv2.putText(vis, "MISSED GT", (x, max(12, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 120, 0), 1)

    return vis


def evaluate_detector_on_dataset(
    detector: InsectDetector,
    image_paths: List[Path],
    output_dir: Optional[Path] = None,
    iou_thresh: float = 0.3,
) -> Dict[str, Any]:
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_time_ms = 0.0

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)

    for p in image_paths:
        img = cv2.imread(str(p))
        if img is None:
            continue
        h, w = img.shape[:2]
        txt_path = p.with_suffix(".txt")
        gt = load_yolo_labels(txt_path, w, h)

        t0 = time.perf_counter()
        if detector.config.mode in ("motion", "hybrid"):
            preds = detector.process(img)
        else:
            preds = detector.detect_image(img)
        latency = (time.perf_counter() - t0) * 1000.0
        total_time_ms += latency

        tp, fp, fn = match_boxes(preds, gt, iou_thresh=iou_thresh)
        total_tp += len(tp)
        total_fp += len(fp)
        total_fn += len(fn)

        if output_dir:
            vis = draw_eval_frame(img, tp, fp, fn)
            cv2.imwrite(str(output_dir / f"eval_{p.name}"), vis)

    num_imgs = max(1, len(image_paths))
    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    mean_fp = total_fp / num_imgs
    avg_latency = total_time_ms / num_imgs

    return {
        "images": len(image_paths),
        "tp": total_tp,
        "fp": total_fp,
        "fn": total_fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mean_fp": mean_fp,
        "latency_ms": avg_latency,
        "fps": 1000.0 / max(0.001, avg_latency),
    }


def run_benchmark_comparison(image_paths: List[Path], onnx_path: str = ""):
    """Evaluates EVERY detector (Motion, Appearance, Hybrid, and YOLO if available) into ONE table."""
    modes = ["motion", "appearance", "hybrid"]
    if onnx_path and os.path.exists(onnx_path):
        modes.append("yolo")

    out_base = Path("eval_out")
    table_rows = []

    print("\nEvaluating all detection backends on dataset...")
    for mode in modes:
        cfg = DetectorConfig(mode=mode, onnx_model_path=onnx_path if mode == "yolo" else "", min_hits_n=1)
        det = InsectDetector(cfg)
        mode_out = out_base / mode
        res = evaluate_detector_on_dataset(det, image_paths, output_dir=mode_out)
        table_rows.append((mode.upper(), res))

    print("\n" + "=" * 90)
    print("AI-TO-BOTS / CROP-SIM — DETECTOR PERFORMANCE BENCHMARK MATRIX")
    print("=" * 90)
    header = f"{'Detector Backend':<18} | {'Precision':<10} | {'Recall':<8} | {'F1 Score':<9} | {'FP / Image':<10} | {'Latency':<10} | {'FPS'}"
    print(header)
    print("-" * len(header))

    for name, r in table_rows:
        print(
            f"{name:<18} | {r['precision']:<10.3f} | {r['recall']:<8.3f} | {r['f1']:<9.3f} | {r['mean_fp']:<10.2f} | {r['latency_ms']:<7.1f} ms | {r['fps']:<5.1f}"
        )

    print("=" * 90)
    print(f"Visual validation frames saved to: {out_base.resolve()}\n")


def run_video_fp_test(detector: InsectDetector, video_path: Path) -> Dict[str, Any]:
    """Evaluates false-alarm rate on a recorded video with no insects."""
    if not video_path.exists():
        print(f"Error: Video file not found: {video_path}")
        return {}

    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps if fps > 0 else 0.0
    duration_min = duration_sec / 60.0

    print("\n" + "=" * 80)
    print("NO-INSECT VIDEO FALSE ALARM BENCHMARK TEST")
    print("=" * 80)
    print(f"Video Source:             {video_path.name}")
    print(f"Total Frames:             {total_frames} ({fps:.1f} FPS)")
    print(f"Total Duration:           {duration_sec:.1f} s ({duration_min:.2f} min)")
    print("Evaluating frames with runtime filters & gating...")

    alarm_frames = 0
    total_false_boxes = 0
    frame_idx = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_idx += 1
        preds = detector.process(frame)
        if len(preds) > 0:
            alarm_frames += 1
            total_false_boxes += len(preds)

    cap.release()

    alarms_per_min = (alarm_frames / duration_min) if duration_min > 0 else 0.0
    target_met = (alarms_per_min <= 1.0)

    print("\n" + "-" * 80)
    print(f"Alarm Frames Triggered:    {alarm_frames} / {total_frames} ({alarm_frames/max(1, total_frames):.1%})")
    print(f"Total False Detections:    {total_false_boxes}")
    print(f"False Alarms per Minute:   {alarms_per_min:.2f} / min")
    print(f"Target Threshold (<= 1.0): {'PASS [MET]' if target_met else 'FAIL [EXCEEDED]'}")
    print("=" * 80 + "\n")

    return {
        "video": video_path.name,
        "duration_min": duration_min,
        "alarm_frames": alarm_frames,
        "total_false_boxes": total_false_boxes,
        "alarms_per_min": alarms_per_min,
        "target_met": target_met,
    }


def evaluate_background_dataset(detector: InsectDetector, bg_dir: Path) -> Dict[str, Any]:
    """Evaluates false positive rate on negative/background-only images (people, room, empty bed)."""
    image_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    bg_images = sorted([p for p in bg_dir.glob("*") if p.suffix.lower() in image_exts])
    if not bg_images:
        print(f"No background images found in {bg_dir}.")
        return {}

    total_fps = 0
    images_with_alarms = 0
    print(f"\nEvaluating background-only false positives across {len(bg_images)} images in {bg_dir}...")
    for p in bg_images:
        img = cv2.imread(str(p))
        if img is None:
            continue
        preds = detector.detect_image(img)
        if len(preds) > 0:
            images_with_alarms += 1
            total_fps += len(preds)

    fp_per_img = total_fps / len(bg_images)
    alarm_rate = images_with_alarms / len(bg_images)

    print("\n" + "=" * 80)
    print("BACKGROUND-ONLY FALSE POSITIVE AUDIT")
    print("=" * 80)
    print(f"Total Background Images:   {len(bg_images)}")
    print(f"Images with False Alarms:  {images_with_alarms} ({alarm_rate:.1%})")
    print(f"Total False Detections:    {total_fps}")
    print(f"False Positives per Image: {fp_per_img:.3f}")
    print("=" * 80 + "\n")
    return {
        "images": len(bg_images),
        "fp": total_fps,
        "fp_per_img": fp_per_img,
        "alarm_rate": alarm_rate,
    }


def run_sweep(image_paths: List[Path], onnx_path: str = ""):
    """Grid searches thresholds to optimize F1 score."""
    print("\n" + "=" * 80)
    print("CROP-SIM HYPERPARAMETER GRID SWEEPER")
    print("=" * 80)

    area_vals = [4.0, 8.0, 12.0]
    contrast_vals = [8.0, 12.0, 16.0]
    n_vals = [1, 2]
    m_vals = [3, 5]

    combos = list(itertools.product(area_vals, contrast_vals, n_vals, m_vals))
    results = []

    for idx, (a, c, n, m) in enumerate(combos, 1):
        cfg = DetectorConfig(mode="hybrid", min_area=a, min_contrast=c, min_hits_n=n, history_window_m=m)
        det = InsectDetector(cfg)
        r = evaluate_detector_on_dataset(det, image_paths)
        results.append(((a, c, n, m), r))

    results.sort(key=lambda item: item[1]["f1"], reverse=True)

    print("\nTop 5 Parameter Configurations by F1:")
    print(f"{'Rank':<5} | {'min_area':<9} | {'contrast':<9} | {'N-of-M':<7} | {'Precision':<10} | {'Recall':<8} | {'F1 Score':<8} | {'FP/img'}")
    print("-" * 75)
    for rank, ((a, c, n, m), r) in enumerate(results[:5], 1):
        nm = f"{n}-of-{m}"
        print(f"{rank:<5} | {a:<9.1f} | {c:<9.1f} | {nm:<7} | {r['precision']:<10.3f} | {r['recall']:<8.3f} | {r['f1']:<8.3f} | {r['mean_fp']:<7.2f}")
    print("=" * 80 + "\n")


def main():
    p = argparse.ArgumentParser(description="Crop-Sim Evaluation Tool")
    p.add_argument("--data", default="tests/sample_eval_data", help="Path to images + YOLO labels directory")
    p.add_argument("--detector", default="all", choices=["all", "hybrid", "appearance", "motion", "yolo"])
    p.add_argument("--yolo-model", default="models/yolov8n_insect.onnx", help="Path to YOLO ONNX checkpoint")
    p.add_argument("--conf", type=float, default=None, help="Global confidence threshold override")
    p.add_argument("--class-confs", default=None, help="Path to per-class JSON thresholds")
    p.add_argument("--video-fp-test", default=None, help="Path to 5-minute real video with no insects")
    p.add_argument("--background-data", default=None, help="Directory of background-only images")
    p.add_argument("--sweep", action="store_true", help="Run grid search parameter sweep")
    p.add_argument("--output-dir", default="eval_out", help="Directory for annotated output images")
    args = p.parse_args()

    # Per-class thresholds
    per_class = {0: 0.55, 1: 0.55, 2: 0.55, 3: 0.55}
    if args.class_confs and Path(args.class_confs).exists():
        import json
        with open(args.class_confs, "r") as f:
            cdata = json.load(f)
            for k, v in cdata.items():
                per_class[int(k)] = float(v)
    elif Path("models/thresholds.json").exists():
        import json
        with open("models/thresholds.json", "r") as f:
            cdata = json.load(f)
            for k, v in cdata.items():
                per_class[int(k)] = float(v)

    if args.conf is not None:
        for k in per_class:
            per_class[k] = float(args.conf)

    det_mode = "yolo" if (args.detector == "yolo" or (args.detector == "all" and (args.video_fp_test or args.background_data))) else ("hybrid" if args.detector == "hybrid" else args.detector)
    cfg = DetectorConfig(
        mode=det_mode,
        onnx_model_path=args.yolo_model,
        yolo_conf_thresh=args.conf if args.conf is not None else 0.55,
        per_class_conf=per_class,
        min_hits_n=1,
    )
    det = InsectDetector(cfg)

    if args.video_fp_test:
        run_video_fp_test(det, Path(args.video_fp_test))
        return

    if args.background_data:
        evaluate_background_dataset(det, Path(args.background_data))
        return

    data_dir = Path(args.data)
    if not data_dir.exists():
        sys.exit(f"Error: {data_dir} does not exist.")

    image_exts = {".jpg", ".jpeg", ".png", ".bmp"}
    images = sorted([f for f in data_dir.glob("*") if f.suffix.lower() in image_exts])
    if not images:
        sys.exit(f"No images found in {data_dir}.")

    if args.sweep:
        run_sweep(images, args.yolo_model)
    elif args.detector == "all":
        run_benchmark_comparison(images, args.yolo_model)
    else:
        r = evaluate_detector_on_dataset(det, images, output_dir=Path(args.output_dir))
        print(f"\n[{args.detector.upper()}] P: {r['precision']:.3f} | R: {r['recall']:.3f} | F1: {r['f1']:.3f} | FP/img: {r['mean_fp']:.2f} | Latency: {r['latency_ms']:.1f}ms\n")


if __name__ == "__main__":
    main()

