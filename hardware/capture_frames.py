"""
Frame Capture and Dataset Labelling Utility for Crop-Sim.

Use this utility on the Raspberry Pi or laptop to capture ground-truth dataset frames
from a USB camera or video stream for evaluation and model fine-tuning.

Keyboard Controls:
  [C] or [SPACE] : Capture and save current frame + empty YOLO label template
  [A]           : Toggle automatic interval capture (default: every 3 seconds)
  [Q] or [ESC]   : Quit

Annotation Instructions:
1. Captured images are saved to --output-dir (default: dataset/images/).
2. A corresponding .txt template is saved to dataset/labels/.
3. Annotate using any standard tool:
   - LabelImg: pip install labelImg -> run `labelImg`, set format to YOLO.
   - CVAT: Export as "YOLO 1.1".
   - Roboflow: Upload folder, draw bounding boxes around insect pests, export as "YOLOv8 PyTorch".
4. Label Format per bounding box:
   <class_id> <x_center> <y_center> <width> <height>
   (where coordinates and dimensions are normalized floats in [0.0, 1.0]).
   Example (target moth at center):
   0 0.500000 0.500000 0.040000 0.035000
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2


def main():
    parser = argparse.ArgumentParser(description="Crop-Sim Frame Capture & Dataset Tool")
    parser.add_argument("--source", default="0", help="Camera index (0, 1) or video file")
    parser.add_argument("--output-dir", default="dataset", help="Directory where images and labels will be saved")
    parser.add_argument("--interval", type=float, default=3.0, help="Interval (seconds) for auto-capture mode")
    parser.add_argument("--width", type=int, default=640, help="Capture width")
    parser.add_argument("--height", type=int, default=360, help="Capture height")
    args = parser.parse_args()

    out_base = Path(args.output_dir)
    img_dir = out_base / "images"
    lbl_dir = out_base / "labels"
    img_dir.mkdir(parents=True, exist_ok=True)
    lbl_dir.mkdir(parents=True, exist_ok=True)

    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        sys.exit(f"Error: Unable to open camera source: {args.source}")

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    print("\n" + "=" * 65)
    print("CROP-SIM DATASET CAPTURE TOOL ACTIVE")
    print("=" * 65)
    print(f"Destination Folder: {out_base.resolve()}")
    print("Press [C] or [SPACE] to snapshot frame")
    print("Press [A] to toggle auto-capture mode")
    print("Press [Q] to quit\n" + "=" * 65 + "\n")

    auto_capture = False
    last_auto_time = 0.0
    saved_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            now = time.time()
            capture_now = False

            if auto_capture and (now - last_auto_time >= args.interval):
                capture_now = True
                last_auto_time = now

            disp = frame.copy()
            status_text = f"Saved: {saved_count} | Auto: {'ON (' + str(args.interval) + 's)' if auto_capture else 'OFF'}"
            cv2.putText(disp, status_text, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3)
            cv2.putText(disp, status_text, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 128), 1)

            cv2.imshow("Crop-Sim Frame Capture", disp)
            key = cv2.waitKey(1) & 0xFF

            if key in (ord("c"), 32):  # 'c' or SPACE
                capture_now = True
            elif key == ord("a"):
                auto_capture = not auto_capture
                print(f"[Auto-Capture] {'ENABLED' if auto_capture else 'DISABLED'}")
            elif key in (ord("q"), 27):  # 'q' or ESC
                break

            if capture_now:
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:19]
                filename_base = f"frame_{stamp}"
                img_path = img_dir / f"{filename_base}.jpg"
                lbl_path = lbl_dir / f"{filename_base}.txt"

                cv2.imwrite(str(img_path), frame)
                # Create empty template label file if it does not exist
                if not lbl_path.exists():
                    lbl_path.touch()

                saved_count += 1
                print(f"Captured frame #{saved_count}: {img_path.name}")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print(f"\nCapture completed. Total frames saved: {saved_count}")


if __name__ == "__main__":
    main()
