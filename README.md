# Crop Bed Insect Repelling & Perception System

An evidence-governed agricultural insect perception and deterrence platform. A downward-facing USB webcam observes a 2 m × 1 m crop bed, detects insect pests in real time via computer vision (YOLO ONNX + hybrid appearance/motion), and transmits actuation commands over USB serial to an **STM32 Nucleo-F411RE** microcontroller driving ultrasonic transducers through a TC4427 driver at 12 V.

---

## 1. System Architecture

```
+---------------------------+                +---------------------------+
|    Host PC (Python 3.11)  |                |   STM32 Microcontroller   |
|                           |                |     (Nucleo-F411RE)       |
|  * External USB Webcam    |   USB Serial   |                           |
|  * YOLO ONNX / Hybrid CV  | -------------> |  * TIM3 PWM (Zone A, PB4) |
|  * Target Tracking        |   115200 8N1   |  * TIM1 PWM (Zone B, PA8) |
|  * Confirm / Hold Trigger | <------------- |  * 2 s Safety Failsafe    |
|  * OpenCV Telemetry HUD   |    ASCII Lines |  * 120 s Max Active Time  |
+---------------------------+                +---------------------------+
                                                           |
                                                           v
                                             +---------------------------+
                                             |   TC4427 MOSFET Driver    |
                                             |   12 V VDD, 100 Ohm Res.  |
                                             |   4x 40 kHz Transducers   |
                                             +---------------------------+
```

---

## 2. Directory Layout

- `host/`: Host perception system, OpenCV camera ingestion, YOLO/hybrid detector, trigger logic, and STM32 serial link.
- `firmware/`: STM32Cube HAL firmware project built with PlatformIO (`nucleo_f411re`).
- `training/`: Scripts to fine-tune YOLOv8n / YOLO11n models on agricultural pest datasets and export to static ONNX.
- `docs/`: Electrical wiring diagrams (`wiring.md`) and ASCII serial command protocol (`protocol.md`).
- `hardware/test_images/`: Local repository for real camera images with ground-truth YOLO annotations.

---

## 3. First test: your MacBook's built-in camera (no hardware needed)

```bash
cd agribots
python3 -m venv .venv && source .venv/bin/activate
pip install opencv-python numpy pyserial pytest

# allow camera access first: System Settings > Privacy & Security > Camera > enable Terminal (or your IDE)

python host/main.py --builtin --mock-serial                       # YOLO insect model (default)
python host/main.py --builtin --mock-serial --detector hybrid     # motion + appearance (reacts to anything that moves)
```

- `--builtin` is a **test mode**: it uses the MacBook camera. iPhone/Continuity and virtual cameras are still refused.
- `--mock-serial` prints the commands that would go to the STM32 (`SET A on 40000` …) instead of needing the board.
- The YOLO model knows 4 insects: fall armyworm moth, Spodoptera litura moth, Spodoptera exigua moth, locust.
  To test it with the laptop camera, hold up a phone showing a photo of one of those insects. Each box shows the
  insect name and confidence; when the output switches on, the window gets an orange border.
- Lower `--conf 0.15` if it misses insects, raise it (e.g. `0.4`) if it boxes things that aren't insects.
- If the window stays black or says "delivers no frames", re-check the camera permission and restart the terminal.
- More than one camera (e.g. an iPhone nearby)? Use `--camera 0` (or 1, 2 …) to open an exact one.

### Upgrade to the real USB webcam
Plug the webcam in and simply drop `--builtin`:
```bash
python host/main.py --list-cameras          # the webcam must show as EXTERNAL
python host/main.py --mock-serial           # external webcam only, still without the STM32
python host/main.py --log run.csv           # with the Nucleo plugged in
```

## 4. Quick Start

### Host Setup (macOS / Linux / Windows)
```bash
# 1. Activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install opencv-python numpy pyserial pytest

# 3. List available cameras to verify external USB webcam
python host/main.py --list-cameras

# 4. Run host with mock serial (no hardware connected)
python host/main.py --mock-serial

# 5. Run host with physical STM32 Nucleo
python host/main.py
```

### Firmware Build & Flash (PlatformIO)
```bash
cd firmware
pio run                # Compile firmware using STM32Cube HAL
pio run -t upload      # Flash connected Nucleo-F411RE via ST-Link
pio test -e native     # Run pure C protocol unit tests locally
```

---

## 5. Operational Controls & Hotkeys (Host UI)

- <kbd>A</kbd>: Set mode to **AUTO** (actuation follows insect detection triggers).
- <kbd>O</kbd>: Force transducers **ON** (manual override).
- <kbd>F</kbd>: Force transducers **OFF** (manual standby).
- <kbd>+</kbd> / <kbd>-</kbd>: Adjust transducer frequency $\pm 500\text{ Hz}$.
- <kbd>M</kbd>: Toggle between camera stream and the motion mask (hybrid / motion detectors).
- <kbd>S</kbd>: Snapshot current frame to `host/captures/` for training data collection.
- <kbd>Q</kbd>: Clean exit (transmits `ALLOFF` to STM32 before terminating).
