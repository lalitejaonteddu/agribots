"""
AI-to-Bots / Crop-Sim Standalone Laptop Insect Detection & Output Trigger.

Upgraded pipeline supporting:
1. Still image inspection (--image path/to/file.jpg) via Stage 1 Appearance Detector.
2. Real-time video processing (--source 0 | video.mp4 | stream_url) via Stage 2 Hybrid Detector.
3. Deterrence trigger logic (N consecutive frames -> output ON; hold -> output OFF).
4. Serial driver interface for physical Arduino / relay / sound generator.
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

import cv2
import numpy as np

# Ensure hardware package is importable
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from hardware.detector import DetectorConfig, InsectDetector
except ImportError:
    # Relative import fallback
    from ..hardware.detector import DetectorConfig, InsectDetector


def parse_args():
    p = argparse.ArgumentParser(description="Crop-Sim Insect Perception Engine")
    p.add_argument("--source", default="0", help="Camera index, video file, or stream URL")
    p.add_argument("--image", default=None, help="Path to single still photo to inspect")
    p.add_argument("--detector", default="hybrid", choices=["hybrid", "appearance", "motion", "yolo"], help="Detection backend")
    p.add_argument("--width", type=int, default=960, help="Processing width (frames are resized)")
    p.add_argument("--min-area", type=float, default=8.0, help="Minimum insect blob area in pixels")
    p.add_argument("--max-area", type=float, default=2500.0, help="Maximum insect blob area in pixels")
    p.add_argument("--contrast", type=float, default=10.0, help="Local contrast threshold")
    p.add_argument("--min-count", type=int, default=1, help="Minimum insects for qualifying detection")
    p.add_argument("--confirm", type=int, default=2, help="Consecutive frames required to trigger output")
    p.add_argument("--hold", type=float, default=4.0, help="Seconds to keep output active after last detection")
    p.add_argument("--m-frames", type=int, default=5, help="History window M for tracker")
    p.add_argument("--n-hits", type=int, default=2, help="Min hits N for tracker")
    p.add_argument("--serial", default=None, help="Serial port to send ON/OFF commands to (e.g. /dev/ttyUSB0)")
    p.add_argument("--log", default=None, help="CSV file path for per-frame detection logs")
    p.add_argument("--yolo-model", default="", help="Path to ONNX YOLO model for Stage 3")
    p.add_argument("--no-window", action="store_true", help="Run headless without preview window")
    return p.parse_args()


class Output:
    """Hardware transducer / relay / serial output driver."""

    def __init__(self, port=None):
        self.active = False
        self.ser = None
        if port:
            try:
                import serial

                self.ser = serial.Serial(port, 9600, timeout=0)
                print(f"[Serial] Connected to transducer hardware on {port}")
            except Exception as e:
                print(f"[Serial] Warning: Could not open {port}: {e}")

    def set(self, active: bool):
        if active == self.active:
            return
        self.active = active
        status_text = "ON" if active else "OFF"
        print(f"[{time.strftime('%H:%M:%S')}] BIOACOUSTIC TRANSDUCER OUTPUT: {status_text}", flush=True)
        if self.ser:
            try:
                self.ser.write(b"ON\n" if active else b"OFF\n")
            except Exception as e:
                print(f"[Serial Error] {e}")


def process_still_image(args, detector: InsectDetector):
    """Processes a single still image with the appearance detector."""
    img_path = Path(args.image)
    if not img_path.exists():
        sys.exit(f"Error: Image {args.image} not found.")

    frame = cv2.imread(str(img_path))
    if frame is None:
        sys.exit(f"Error: Unable to decode image {args.image}.")

    t0 = time.perf_counter()
    boxes = detector.detect_image(frame)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    print("\n" + "=" * 55)
    print("AI-TO-BOTS — STILL PHOTO DETECTION REPORT")
    print("=" * 55)
    print(f"File:               {img_path.name}")
    print(f"Dimensions:         {frame.shape[1]} x {frame.shape[0]}")
    print(f"Insects Detected:   {len(boxes)}")
    print(f"Inference Latency:  {elapsed_ms:.2f} ms")
    print("=" * 55)

    for idx, (x, y, w, h) in enumerate(boxes, 1):
        print(f"  Target #{idx}: x={x}, y={y}, w={w}, h={h}")

    if not args.no_window:
        vis = frame.copy()
        for x, y, w, h in boxes:
            cv2.rectangle(vis, (x - 2, y - 2), (x + w + 2, y + h + 2), (0, 255, 128), 2)
            cv2.putText(vis, "INSECT", (x, max(15, y - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 128), 1)

        status = f"Detected: {len(boxes)} insect(s) | {elapsed_ms:.1f}ms"
        cv2.putText(vis, status, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 4)
        cv2.putText(vis, status, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
        cv2.imshow("Crop-Sim Still Image Detection", vis)
        print("\nPress any key in preview window to close...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def process_video_stream(args, detector: InsectDetector):
    """Processes video or camera stream with the hybrid detector."""
    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        sys.exit(f"Could not open source {args.source!r}")

    out = Output(args.serial)
    log_file = None
    log_writer = None
    if args.log:
        log_file = open(args.log, "w", newline="")
        log_writer = csv.writer(log_file)
        log_writer.writerow(["time", "frame", "count", "output_on", "fps", "latency_ms"])

    frame_no = 0
    streak = 0
    last_seen = 0.0

    print("\n" + "=" * 60)
    print(f"CROP-SIM VIDEO PIPELINE ACTIVE [Backend: {args.detector.upper()}]")
    print("=" * 60)
    print(f"Source: {args.source} | Target Width: {args.width}px")
    print("Press 'q' in window to exit.\n")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_no += 1

            # Execute detector (preserves process(frame) signature)
            boxes = detector.process(frame)
            now = time.time()
            hit = len(boxes) >= args.min_count

            # Deterrence trigger
            streak = streak + 1 if hit else 0
            if hit:
                last_seen = now

            if not out.active and streak >= args.confirm:
                out.set(True)
            elif out.active and now - last_seen > args.hold:
                out.set(False)

            stats = detector.get_timing_stats()

            if log_writer:
                log_writer.writerow([
                    f"{now:.3f}",
                    frame_no,
                    len(boxes),
                    int(out.active),
                    f"{stats.get('fps', 0.0):.1f}",
                    f"{stats.get('total_ms', 0.0):.2f}",
                ])

            if not args.no_window:
                disp = frame.copy()
                for x, y, w, h in boxes:
                    cv2.rectangle(disp, (x - 2, y - 2), (x + w + 2, y + h + 2), (77, 225, 255), 2)
                    cv2.putText(disp, "INSECT", (x, max(15, y - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (77, 225, 255), 1)

                status = f"{len(boxes)} insects | output {'ACTIVE' if out.active else 'STANDBY'} | {stats.get('fps', 0.0):.1f} FPS"
                cv2.putText(disp, status, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 0), 4)
                cv2.putText(disp, status, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
                cv2.imshow("Crop-Sim Insect Detector", disp)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
    finally:
        out.set(False)
        cap.release()
        cv2.destroyAllWindows()
        if log_file:
            log_file.close()


def main():
    args = parse_args()

    config = DetectorConfig(
        mode=args.detector,
        target_width=args.width,
        min_area=args.min_area,
        max_area=args.max_area,
        min_contrast=args.contrast,
        history_window_m=args.m_frames,
        min_hits_n=args.n_hits,
        onnx_model_path=args.yolo_model,
    )
    detector = InsectDetector(config)

    if args.image:
        process_still_image(args, detector)
    else:
        process_video_stream(args, detector)


if __name__ == "__main__":
    main()
