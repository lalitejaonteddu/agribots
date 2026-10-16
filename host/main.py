"""
Crop-Sim Host Perception & STM32 Controller Supervisor (Part 3).

Single entry point: python host/main.py
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np

# Ensure host directory is in sys.path
HOST_DIR = Path(__file__).resolve().parent
REPO_DIR = HOST_DIR.parent
if str(HOST_DIR) not in sys.path:
    sys.path.insert(0, str(HOST_DIR))

from camera import ExternalWebcamStream, print_camera_list
from detector import DetectorConfig, InsectDetector
from homography import BedHomography
from stm32_client import STM32SerialClient
from trigger import DeterrenceTrigger, TriggerConfig
from web_bridge import WebBridge

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s")
logger = logging.getLogger("CropSimHost")


def parse_args():
    p = argparse.ArgumentParser(description="Crop-Sim Agricultural Pest Supervisor")
    p.add_argument("--list-cameras", action="store_true", help="List and audit all cameras, then exit")
    p.add_argument("--camera", type=int, default=None, help="Open this exact camera index (skips the external-only check)")
    p.add_argument("--builtin", action="store_true",
                   help="TEST MODE: use the laptop's built-in camera (e.g. MacBook FaceTime camera)")
    p.add_argument("--camera-name", default=None, help="Name substring to match external USB webcam")
    p.add_argument("--video", default=None, help="Path to video file (.mp4, .avi)")
    p.add_argument("--image", default=None, help="Path to single photo (.jpg, .png)")
    p.add_argument("--folder", default=None, help="Process directory of still photos")
    p.add_argument("--detector", default="auto", choices=["auto", "yolo", "hybrid", "motion", "appearance"],
                   help="auto = yolo if the model file exists, else hybrid")
    p.add_argument("--yolo-model", default=str(REPO_DIR / "models" / "yolov8n_insect.onnx"), help="Path to ONNX YOLO model")
    p.add_argument("--conf", type=float, default=None, help="YOLO confidence threshold (0-1). If provided, overrides all per-class thresholds.")
    p.add_argument("--class-confs", default=None, help="Path to JSON file with per-class thresholds")
    p.add_argument("--max-box-frac", type=float, default=0.04, help="Max box area fraction of frame (default 0.04)")
    p.add_argument("--min-box-side", type=int, default=6, help="Min shorter side of box in pixels (default 6)")
    p.add_argument("--phone-test", action="store_true",
                   help="Testing with insect photos on a phone held up to camera (= --allow-screens --max-box-frac 0.45)")
    p.add_argument("--allow-screens", action="store_true",
                   help="Testing: allow insects shown on a phone/laptop screen (not vetoed by object gate)")
    p.add_argument("--no-filters", action="store_true",
                   help="Disable false-alarm filters (raw YOLO detections)")
    p.add_argument("--coco-model", default=str(REPO_DIR / "models" / "coco_yolov8n.onnx"), help="Path to COCO YOLO model for person/object gating")
    p.add_argument("--roi-setup", action="store_true", help="Interactive tool to click 4 crop bed corners and save to host/roi.json")
    p.add_argument("--roi-file", default=str(HOST_DIR / "roi.json"), help="Path to ROI JSON polygon file")
    p.add_argument("--yolo-window", type=int, default=5, help="Temporal window M for YOLO tracks (default 5)")
    p.add_argument("--yolo-min-hits", type=int, default=2, help="Minimum detections N in last M frames (default 2)")
    p.add_argument("--yolo-min-conf", type=float, default=None, help="Minimum mean confidence required for YOLO track confirmation (default: uses class threshold)")
    p.add_argument("--debug", action="store_true", help="Draw COCO suppressor boxes in grey, ROI outline in cyan, and show filter stats")
    p.add_argument("--width", type=int, default=640, help="Processing frame width")
    p.add_argument("--freq", type=int, default=40000, help="Initial transducer frequency (Hz)")
    p.add_argument("--zones", default="AB", choices=["A", "B", "AB"], help="Active zones (AB, A, or B)")
    p.add_argument("--min-count", type=int, default=1, help="Min insects for qualifying frame")
    p.add_argument("--confirm", type=int, default=2, help="Consecutive frames required to trigger")
    p.add_argument("--hold", type=float, default=4.0, help="Hold time in seconds")
    p.add_argument("--port", default=None, help="Serial port to STM32 (auto-detected if None)")
    p.add_argument("--mock-serial", action="store_true", help="Run with simulated mock serial connection")
    p.add_argument("--log", default=None, help="Path to CSV log file (e.g. run.csv)")
    p.add_argument("--no-window", action="store_true", help="Run headless without OpenCV window")
    p.add_argument("--web", action="store_true", help="Start WebBridge aiohttp server for 3D live mirror")
    p.add_argument("--web-host", default="127.0.0.1", help="WebBridge bind host (default: 127.0.0.1, use 0.0.0.0 for LAN)")
    p.add_argument("--web-port", type=int, default=8765, help="WebBridge port (default: 8765)")
    p.add_argument("--save-hits", action="store_true", help="Auto-save high-confidence detection photos to captures/hits/")
    return p.parse_args()


def resolve_detector(args):
    """Pick the detector mode and build its config."""
    if getattr(args, "phone_test", False):
        args.allow_screens = True
        args.max_box_frac = max(args.max_box_frac, 0.45)
        args.yolo_min_hits = min(getattr(args, "yolo_min_hits", 2), 2)
        args.yolo_min_conf = None
        print("[Testing Mode] --phone-test active: screen veto disabled, max box relaxed to 45% of frame")

    mode = args.detector
    if mode == "auto":
        mode = "yolo" if Path(args.yolo_model).exists() else "hybrid"
    if mode == "yolo" and not Path(args.yolo_model).exists():
        sys.exit(f"YOLO model not found: {args.yolo_model}")
    args.detector = mode

    per_class = {0: 0.55, 1: 0.55, 2: 0.55, 3: 0.55}
    if args.class_confs and Path(args.class_confs).exists():
        with open(args.class_confs, "r") as f:
            cdata = json.load(f)
            for k, v in cdata.items():
                per_class[int(k)] = float(v)
    elif Path("models/thresholds.json").exists():
        with open("models/thresholds.json", "r") as f:
            cdata = json.load(f)
            for k, v in cdata.items():
                per_class[int(k)] = float(v)

    if args.conf is not None:
        for k in per_class:
            per_class[k] = float(args.conf)

    return DetectorConfig(
        mode=mode,
        target_width=args.width,
        onnx_model_path=args.yolo_model if mode == "yolo" else "",
        yolo_conf_thresh=args.conf if args.conf is not None else 0.55,
        per_class_conf=per_class,
        use_filters=not args.no_filters,
        allow_screens=args.allow_screens,
        max_box_frac=args.max_box_frac,
        min_box_side=args.min_box_side,
        coco_model_path=args.coco_model if (not args.no_filters) else "",
        roi_path=args.roi_file if (not args.no_filters) else "",
        yolo_history_window_m=args.yolo_window,
        yolo_min_hits_n=args.yolo_min_hits,
        yolo_min_mean_conf=args.yolo_min_conf,
        debug=args.debug,
    )


def run_roi_setup(args):
    """Interactive tool to click 4 corners of the crop bed and save to host/roi.json."""
    from camera import ExternalWebcamStream

    print("\n" + "=" * 60)
    print("ROI SETUP: Click 4 corners of the crop bed (TL -> TR -> BR -> BL)")
    print("Hotkeys: [C] Clear / Restart clicks | [S] Save & Exit | [Q] Cancel")
    print("=" * 60)

    stream = None
    cap = None
    if args.video:
        cap = cv2.VideoCapture(args.video)
    else:
        stream = ExternalWebcamStream(
            camera_index=args.camera,
            name_substring=args.camera_name,
            target_width=args.width,
            allow_builtin=args.builtin,
        )
        if not stream.open():
            sys.exit("Error: Could not open camera for ROI setup.")

    clicked_points: List[Tuple[int, int]] = []

    def mouse_callback(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            if len(clicked_points) < 4:
                clicked_points.append((x, y))
                print(f"Point {len(clicked_points)} clicked at: ({x}, {y})")

    win_name = "ROI Setup — Click 4 Corners of Crop Bed"
    cv2.namedWindow(win_name)
    cv2.setMouseCallback(win_name, mouse_callback)

    try:
        while True:
            if stream:
                ok, frame = stream.read()
            else:
                ok, frame = cap.read()
                if not ok:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue

            if not ok or frame is None:
                time.sleep(0.05)
                continue

            disp = frame.copy()

            corner_names = ["1: Front-Left (FL)", "2: Front-Right (FR)", "3: Back-Right (BR)", "4: Back-Left (BL)"]
            for idx, pt in enumerate(clicked_points):
                cv2.circle(disp, pt, 6, (0, 0, 255), -1)
                label = corner_names[idx].split(":")[1].strip() if idx < len(corner_names) else f"{idx+1}"
                cv2.putText(disp, label, (pt[0] + 8, pt[1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)

            if len(clicked_points) >= 2:
                for i in range(len(clicked_points) - 1):
                    cv2.line(disp, clicked_points[i], clicked_points[i+1], (0, 255, 255), 2)
            if len(clicked_points) == 4:
                cv2.line(disp, clicked_points[3], clicked_points[0], (0, 255, 255), 2)
                msg = "All 4 corners clicked! Press [S] to save or [C] to retry."
            else:
                msg = f"Click inside corner {corner_names[len(clicked_points)]} [C: Clear | Q: Quit]"

            cv2.rectangle(disp, (0, 0), (disp.shape[1], 38), (20, 20, 20), -1)
            cv2.putText(disp, msg, (15, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255) if len(clicked_points) == 4 else (255, 255, 255), 2)

            cv2.imshow(win_name, disp)
            k = cv2.waitKey(20) & 0xFF
            if k in (ord('q'), 27):
                print("ROI setup cancelled.")
                break
            elif k == ord('c'):
                clicked_points.clear()
                print("Cleared clicked points.")
            elif k == ord('s') or len(clicked_points) == 4:
                if len(clicked_points) == 4:
                    roi_path = Path(args.roi_file)
                    hom = BedHomography(roi_path=roi_path)
                    hom.save_roi(clicked_points)
                    print(f"\n[ROI Setup] Successfully saved 4 corners to {roi_path.resolve()}: {clicked_points}\n")
                    time.sleep(0.5)
                    break
                else:
                    print(f"Please click all 4 corners before saving (currently {len(clicked_points)}/4).")
    finally:
        if stream:
            stream.release()
        if cap:
            cap.release()
        cv2.destroyAllWindows()


def draw_detections(img, boxes, labels):
    for (x, y, w, h), (name, conf) in zip(boxes, labels):
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 128), 2)
        text = f"{name} {conf:.0%}" if conf > 0 else name
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        ty = max(th + 4, y - 4)
        cv2.rectangle(img, (x, ty - th - 4), (x + tw + 6, ty + 2), (0, 255, 128), -1)
        cv2.putText(img, text, (x + 3, ty - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)


def process_single_photo(photo_path: Path, detector: InsectDetector, args):
    """Processes a single still image, displays findings, and saves an annotated copy."""
    img = cv2.imread(str(photo_path))
    if img is None:
        sys.exit(f"Error: Unable to load photo {photo_path}")

    t0 = time.perf_counter()
    boxes = detector.detect_image(img)
    latency_ms = (time.perf_counter() - t0) * 1000.0

    print("\n" + "=" * 60)
    print("AI-TO-BOTS / CROP-SIM — STILL PHOTO INSPECTION")
    print("=" * 60)
    print(f"Image:             {photo_path.name}")
    print(f"Dimensions:        {img.shape[1]} x {img.shape[0]}")
    print(f"Insects Detected:  {len(boxes)}")
    print(f"Processing Time:   {latency_ms:.2f} ms")
    print("=" * 60)

    labels = detector.describe(boxes)
    for (name, conf) in labels:
        print(f"  - {name}" + (f"  ({conf:.0%})" if conf > 0 else ""))
    vis = img.copy()
    draw_detections(vis, boxes, labels)

    out_dir = Path("host/captures")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"annotated_{photo_path.name}"
    cv2.imwrite(str(out_path), vis)
    print(f"Annotated photo saved to: {out_path.resolve()}\n")

    if not args.no_window:
        cv2.imshow("Crop-Sim Photo Inspection", vis)
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def run_host_stream(args):
    # Serial Link
    serial_client = STM32SerialClient(port=args.port, mock=args.mock_serial)
    serial_client.connect()

    # Trigger Engine
    trigger_cfg = TriggerConfig(
        min_count=args.min_count,
        confirm_frames=args.confirm,
        hold_seconds=args.hold,
        zones=args.zones,
    )
    trigger = DeterrenceTrigger(trigger_cfg)

    # Detector
    detector = InsectDetector(resolve_detector(args))

    # Video Source
    webcam_stream: Optional[ExternalWebcamStream] = None
    video_cap: Optional[cv2.VideoCapture] = None

    source_label = "VIDEO"
    if args.video:
        video_cap = cv2.VideoCapture(args.video)
        if not video_cap.isOpened():
            sys.exit(f"Error opening video file: {args.video}")
    else:
        # Strict External Webcam
        def on_unplug():
            serial_client.all_off()

        webcam_stream = ExternalWebcamStream(
            camera_name=args.camera_name,
            on_unplug_callback=on_unplug,
            allow_builtin=args.builtin,
            camera_index=args.camera,
        )
        try:
            webcam_stream.open()
        except RuntimeError as e:
            serial_client.all_off()
            sys.exit(f"\n[Camera] {e}\n")
        source_label = (
            "BUILT-IN CAM (test)" if args.builtin else f"CAM {args.camera}" if args.camera is not None else "USB WEBCAM"
        )

    # CSV Logger
    csv_file = None
    csv_writer = None
    if args.log:
        csv_file = open(args.log, "w", newline="")
        csv_writer = csv.writer(csv_file)
        csv_writer.writerow(["time", "count", "zoneA", "zoneB", "freq_hz", "mode", "serial_state"])

    # UI & State Variables
    mode = "AUTO"  # AUTO | MANUAL_ON | MANUAL_OFF
    current_freq = args.freq
    show_mask = False
    last_log_sec = 0
    frame_idx = 0
    fps_history = []
    last_sent = None  # (zoneA, zoneB, freq) last sent to the STM32
    last_loop = time.perf_counter()
    # Bed Homography for 3D coordinate mapping
    homography = BedHomography(roi_path=args.roi_file)

    # Web Bridge server
    bridge: Optional[WebBridge] = None
    if args.web:
        bridge = WebBridge(host=args.web_host, port=args.web_port)
        bridge.start()

    print("\n" + "=" * 65)
    print(f"CROP-SIM HOST SUPERVISOR RUNNING [Detector: {args.detector.upper()} | Source: {source_label}]")
    print("=" * 65)
    print("Hotkeys: [A] Auto | [O] Force On | [F] Force Off | [+/-] Freq | [M] Mask | [S] Snapshot | [Q] Quit\n")

    try:
        while True:
            # 0. Check incoming commands from WebBridge (browser controls)
            if bridge:
                while True:
                    cmd_item = bridge.get_command()
                    if not cmd_item:
                        break
                    cmd, val = cmd_item
                    if cmd == "mode":
                        cmd_mode = str(val).upper()
                        if cmd_mode in ("ON", "MANUAL_ON"):
                            mode = "MANUAL_ON"
                            serial_client.set_zone("A", True, current_freq)
                            serial_client.set_zone("B", True, current_freq)
                        elif cmd_mode in ("OFF", "MANUAL_OFF"):
                            mode = "MANUAL_OFF"
                            serial_client.all_off()
                        else:
                            mode = "AUTO"
                        print(f"[WebBridge Command] Mode set to {mode}")
                    elif cmd == "freq":
                        try:
                            current_freq = max(1000, min(50000, int(val)))
                            print(f"[WebBridge Command] Frequency set to {current_freq} Hz")
                        except ValueError:
                            pass
            # 1. Maintain Serial Heartbeat & Reconnect
            serial_client.tick_maintenance()

            # 2. Acquire Frame
            if webcam_stream:
                ok, frame = webcam_stream.read()
                if not ok:
                    # Attempt reconnect every 2s
                    time.sleep(0.1)
                    webcam_stream.attempt_reconnect()
                    continue
            else:
                ok, frame = video_cap.read()
                if not ok:
                    # Loop video
                    video_cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue

            frame_idx += 1
            t_start = time.perf_counter()

            # 3. Perception / Detection
            boxes = detector.process(frame)
            latency_ms = (time.perf_counter() - t_start) * 1000.0

            now_t = time.perf_counter()
            fps_history.append(1.0 / max(1e-3, now_t - last_loop))  # real loop rate (camera + detection + UI)
            last_loop = now_t
            if len(fps_history) > 30:
                fps_history.pop(0)
            avg_fps = sum(fps_history) / len(fps_history)

            # 4. Trigger & Actuation Evaluation
            is_active, changed = trigger.update(len(boxes))

            # Mode overrides & Person Gate Pause
            if getattr(detector, "person_in_view", False):
                # Hard safety pause: person is present in the frame (>20% area)
                target_a, target_b = False, False
            elif mode == "MANUAL_ON":
                target_a, target_b = True, True
            elif mode == "MANUAL_OFF":
                target_a, target_b = False, False
            else:
                target_a, target_b = trigger.get_zone_states()

            # after the board (re)connects, resend the full state
            if serial_client.is_connected and not getattr(serial_client, "_was_connected", False):
                last_sent = None
            serial_client._was_connected = serial_client.is_connected

            # Transmit to STM32 whenever the wanted state differs from what was last sent
            # (covers trigger changes, mode switches and frequency changes)
            wanted = (target_a, target_b, current_freq)
            if wanted != last_sent or (changed and serial_client.is_connected):
                serial_client.set_zone("A", target_a, current_freq)
                serial_client.set_zone("B", target_b, current_freq)
                last_sent = wanted

            # 5. Periodic 1 Hz Logging
            now_sec = int(time.time())
            if csv_writer and now_sec != last_log_sec:
                last_log_sec = now_sec
                ser_state = "FAILSAFE" if serial_client.failsafe_active else ("CONNECTED" if serial_client.is_connected else "DISCONNECTED")
                csv_writer.writerow([
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    len(boxes),
                    int(target_a),
                    int(target_b),
                    current_freq,
                    mode,
                    ser_state,
                ])
                csv_file.flush()

            # 6. Render OpenCV HUD
            if not args.no_window:
                mask = getattr(detector, "last_mask", None)
                if show_mask and mask is not None:
                    disp = cv2.cvtColor(cv2.resize(mask, (frame.shape[1], frame.shape[0])), cv2.COLOR_GRAY2BGR)
                else:
                    disp = frame.copy()

                # Draw calibrated ROI boundary if set
                roi_poly = getattr(detector.config, "roi_polygon", None)
                if roi_poly and len(roi_poly) >= 3:
                    pts = np.array(roi_poly, np.int32).reshape((-1, 1, 2))
                    cv2.polylines(disp, [pts], isClosed=True, color=(255, 255, 0), thickness=2)
                    cv2.putText(disp, "ROI ZONE", (pts[0][0][0], max(16, pts[0][0][1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 0), 1)

                # Draw COCO suppressor detections in grey when --debug is active
                if args.debug and getattr(detector, "last_coco_boxes", None):
                    for (cx, cy, cw, ch), cconf, ccls in detector.last_coco_boxes:
                        cv2.rectangle(disp, (cx, cy), (cx + cw, cy + ch), (128, 128, 128), 1)
                        cname = "person" if ccls == 0 else f"coco_{ccls}"
                        cv2.putText(disp, f"{cname} {cconf:.0%}", (cx + 2, max(12, cy - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (128, 128, 128), 1)

                draw_detections(disp, boxes, detector.describe(boxes))

                # Overlay status banner
                ser_status_str = "MOCK" if serial_client.mock else ("FAILSAFE" if serial_client.failsafe_active else ("OK" if serial_client.is_connected else "OFFLINE"))
                bar_text = f"{source_label} | {args.detector.upper()} | FPS: {avg_fps:.1f} | Insects: {len(boxes)} | Zone A: {'ON' if target_a else 'OFF'} | Zone B: {'ON' if target_b else 'OFF'} | {current_freq} Hz | Mode: {mode} | Serial: {ser_status_str}"
                bar_scale = max(0.45, disp.shape[1] / 1800)
                bar_h = int(40 * bar_scale / 0.52)
                cv2.rectangle(disp, (0, 0), (disp.shape[1], bar_h), (20, 20, 20), -1)
                cv2.putText(disp, bar_text, (10, int(bar_h * 0.66)), cv2.FONT_HERSHEY_SIMPLEX, bar_scale, (255, 255, 255), 1)

                if getattr(detector, "person_in_view", False):
                    # Show prominent PERSON IN VIEW banner
                    text_warn = "PERSON IN VIEW — paused"
                    (tw, th), _ = cv2.getTextSize(text_warn, cv2.FONT_HERSHEY_SIMPLEX, 0.85, 2)
                    warn_y = int(disp.shape[0] * 0.88)
                    warn_x = max(10, (disp.shape[1] - tw) // 2)
                    cv2.rectangle(disp, (warn_x - 12, warn_y - th - 10), (warn_x + tw + 12, warn_y + 10), (0, 0, 180), -1)
                    cv2.putText(disp, text_warn, (warn_x, warn_y), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
                elif target_a or target_b:
                    cv2.rectangle(disp, (0, 0), (disp.shape[1] - 1, disp.shape[0] - 1), (255, 160, 30), 6)

            # 7. Update WebBridge for 3D Live Mirror
            if bridge:
                confirmed_tracks = detector.get_confirmed_tracks()
                t_boxes = [t[1] for t in confirmed_tracks]
                t_labels = detector.describe(t_boxes)
                detections_payload = []
                for (tid, tbox, tconf), (tlbl, tdesc_conf) in zip(confirmed_tracks, t_labels):
                    bpos = homography.box_to_bed(tbox)
                    best_conf = max(tconf, tdesc_conf) if tdesc_conf > 0 else tconf
                    det_dict = {
                        "id": tid,
                        "box": list(tbox),
                        "label": tlbl,
                        "conf": round(float(best_conf), 2),
                        "bed": bpos,
                    }
                    detections_payload.append(det_dict)
                    if args.save_hits and best_conf >= 0.70:
                        bridge.save_hit(frame, det_dict)

                out_src = "stm32" if serial_client.is_connected and not serial_client.mock else "host-trigger"
                out_payload = {
                    "active": bool(target_a or target_b),
                    "zoneA": bool(target_a),
                    "zoneB": bool(target_b),
                    "freq": int(current_freq),
                    "mode": "ON" if mode == "MANUAL_ON" else ("OFF" if mode == "MANUAL_OFF" else "AUTO"),
                    "source": out_src,
                }
                ser_str = "FAILSAFE" if serial_client.failsafe_active else ("CONNECTED" if serial_client.is_connected else "NOT CONNECTED")
                warn_list = []
                if homography.warning:
                    warn_list.append(homography.warning)
                if getattr(detector, "person_in_view", False):
                    warn_list.append("PERSON IN VIEW — deterrence paused")

                bridge.update_frame(
                    raw_frame=frame,
                    annotated_frame=disp if not args.no_window else frame,
                    detections=detections_payload,
                    fps=avg_fps,
                    output_state=out_payload,
                    serial_status=ser_str,
                    camera_name=source_label,
                    warnings=warn_list,
                )

            if not args.no_window:
                cv2.imshow("Crop-Sim Insect Perception & Control", disp)
                key = cv2.waitKey(1) & 0xFF

                if key in (ord("q"), 27):
                    break
                elif key == ord("a"):
                    mode = "AUTO"
                    print("[Host Mode] Switched to AUTO")
                elif key == ord("o"):
                    mode = "MANUAL_ON"
                    serial_client.set_zone("A", True, current_freq)
                    serial_client.set_zone("B", True, current_freq)
                    print("[Host Mode] Forced ON")
                elif key == ord("f"):
                    mode = "MANUAL_OFF"
                    serial_client.all_off()
                    print("[Host Mode] Forced OFF")
                elif key in (ord("+"), ord("=")):
                    current_freq = min(50000, current_freq + 500)
                    print(f"[Frequency] +500 Hz -> {current_freq} Hz")
                elif key in (ord("-"), ord("_")):
                    current_freq = max(1000, current_freq - 500)
                    print(f"[Frequency] -500 Hz -> {current_freq} Hz")
                elif key == ord("m"):
                    show_mask = not show_mask
                    if show_mask and getattr(detector, "last_mask", None) is None:
                        print("[Mask] No motion mask in YOLO mode — run with --detector hybrid to see it")
                elif key == ord("x"):
                    neg_dir = Path("data/negatives")
                    neg_dir.mkdir(parents=True, exist_ok=True)
                    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    neg_img = neg_dir / f"neg_{stamp}.jpg"
                    neg_txt = neg_dir / f"neg_{stamp}.txt"
                    cv2.imwrite(str(neg_img), frame)
                    neg_txt.touch()
                    logged = detector.describe(boxes)
                    print(f"\n[FALSE ALARM FLAGGED] Saved {neg_img} with empty label {neg_txt}")
                    print(f"  Discarded false detections ({len(boxes)}): {logged}\n")
                elif key == ord("s"):
                    pos_dir = Path("data/positives")
                    pos_dir.mkdir(parents=True, exist_ok=True)
                    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    pos_img = pos_dir / f"pos_{stamp}.jpg"
                    cv2.imwrite(str(pos_img), frame)
                    print(f"\n[POSITIVE SAVED] Saved frame to {pos_img} for labelling\n")

    finally:
        print("\nTerminating supervisor... Sending ALLOFF to STM32.")
        serial_client.all_off()
        serial_client.disconnect()
        if bridge:
            bridge.stop()
        if webcam_stream:
            webcam_stream.release()
        if video_cap:
            video_cap.release()
        cv2.destroyAllWindows()
        if csv_file:
            csv_file.close()


def main():
    args = parse_args()
    if args.list_cameras:
        print_camera_list()
        return

    if args.roi_setup:
        run_roi_setup(args)
        return

    if args.image:
        detector = InsectDetector(resolve_detector(args))
        process_single_photo(Path(args.image), detector, args)
    elif args.folder:
        detector = InsectDetector(resolve_detector(args))
        folder_path = Path(args.folder)
        image_exts = {".jpg", ".jpeg", ".png", ".bmp"}
        files = sorted([f for f in folder_path.glob("*") if f.suffix.lower() in image_exts])
        print(f"Processing {len(files)} photos in {folder_path}...")
        for f in files:
            process_single_photo(f, detector, args)
    else:
        run_host_stream(args)


if __name__ == "__main__":
    main()
