"""
Export Fine-Tuned YOLO Model to Static ONNX (Part B.4).

Export constraints:
- Static input shape: 1x3x416x416 or 1x3x640x640
- opset: 12
- Simplified graph compatible with OpenCV DNN cv2.dnn.readNetFromONNX
- Copies best model to models/yolov8n_insect.onnx
- Exports class names to models/classes.txt
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description="Export YOLO to ONNX")
    parser.add_argument("--weights", default="training/runs/insect_detector/weights/best.pt")
    parser.add_argument("--output", default="models/yolov8n_insect.onnx")
    parser.add_argument("--imgsz", type=int, default=416)
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        sys.exit("Install ultralytics to export models: pip install ultralytics")

    weights_path = Path(args.weights)
    if not weights_path.exists():
        fallback = Path.home() / "drive-aware/runs/detect/training/runs/insect_detector/weights/best.pt"
        if fallback.exists():
            weights_path = fallback
        else:
            sys.exit(f"Checkpoint weights not found: {weights_path}")

    print("\n" + "=" * 60)
    print("EXPORTING YOLO CHECKPOINT TO STATIC ONNX (opset 12)")
    print("=" * 60)
    print(f"Source Weights: {weights_path.resolve()}")
    print(f"Target Output:  {args.output}")
    print(f"Input Size:     {args.imgsz}x{args.imgsz}")

    model = YOLO(str(weights_path))
    exported_file = model.export(
        format="onnx",
        imgsz=args.imgsz,
        opset=12,
        dynamic=False,
        simplify=True,
    )

    out_onnx = Path(args.output)
    out_onnx.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(exported_file, out_onnx)
    print(f"Successfully copied ONNX model to: {out_onnx.resolve()}")

    # Write class names to models/classes.txt
    classes_txt = out_onnx.parent / "classes.txt"
    with open(classes_txt, "w") as f:
        for cid in sorted(model.names.keys()):
            f.write(f"{model.names[cid]}\n")
    print(f"Wrote {len(model.names)} class names to: {classes_txt.resolve()}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
