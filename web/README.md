# Crop Bed Testbed — interactive 3D model

A navigable 3D reconstruction of the cardboard crop bed in the reference photo, built with
React, Vite, Three.js, React Three Fiber and Drei. Every object is real geometry at
**1 world unit = 1 metre** — nothing uses the reference image as a texture.

## Run it

Requires Node.js 18+ (tested on Node 22).

```bash
cd crop-sim
npm install
npm run dev          # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview      # serves dist/ on http://localhost:4173
```

## What's in the scene

| Part | Spec (edit in `src/config/setup.js`) |
|---|---|
| Cardboard planter | 2.0 × 1.0 × 0.3 m outer, open top, 9 mm corrugated walls that bow slightly under the soil, taped corners, fold crease, soil staining |
| Soil | 0.25 m deep, uneven surface with mounding at stems, clods and pebbles |
| Crops | 12 young maize-type plants in two rows, 0.30–0.80 m above soil, spaced so the soil stays visible, plus a few small seedlings |
| Corner pillars | 4 free-standing galvanised tubes on foot plates just outside the box corners, 2.0 m above soil level, no horizontal frame |
| Central mast | 2.0 m above soil, offset arm, pan-tilt joint, industrial box camera with rain hood, lens pointing down |
| Modules | Emitter head on each corner pillar (1.0 m above soil, angled down at the bed); sensor boxes on the two front pillars |
| Emission | **Shield** (default): a translucent cuboid joining the four pillars, floor to pillar tops, with blurry noisy sound waves rippling across every face and edge. Also **waves** (pulses from each pillar) and **light** beams (real spotlights) — switch with the panel or `E` |

## Controls

| Action | Input |
|---|---|
| Orbit / pan / zoom | drag · right-drag (or two-finger drag) · scroll / pinch |
| Reset · Top · Side · Camera view | buttons, or keys `1` `2` `3` `4` |
| Leave Camera view | `Esc` |
| Dimensions on/off | `D` |
| Live camera panel on/off | `L` (click the panel to enter Camera View) |
| Treated / control zones | `Z` |
| Pillar emission: Off / Shield / Waves / Light | panel buttons, or `E` to cycle |
| Save a CAM-01 frame as PNG | `C` |
| Insects on/off · send swarm in now | `I` · `R` |

**Camera View** switches rendering to a separate `PerspectiveCamera` sitting in the mast
camera's lens. The **live panel** renders that camera into an off-screen render target every
frame (1024×576) and shows it in a HUD. Dimension lines, zones and speaker overlays live on
layer 1, so the mast camera never sees annotations.

## Insect detection → output (closed loop)

```
insects fly in ─► CAM-01 frame ─► OpenCV (in a Web Worker) ─► trigger ─► shield / waves / light runs
                                                              (scripted) insects leave ─► no detections ─► output stops
```

- **Insect swarm** (`experiment/insects/`): moths and beetles that arrive from outside, forage over the
  plants, land, and leave. Swarm size, insect size (1–6×, default 3× life size so they are easy to see), "send swarm in now" (`R`) and on/off (`I`) are in the panel.
- **OpenCV detection** (`experiment/vision/cvWorker.js`, OpenCV.js 4.10): every ~160 ms the mast camera
  renders a 512×288 frame (physical objects only), and OpenCV runs MOG2 background subtraction →
  removes green vegetation → morphology → contours. Boxes are drawn on the live panel and in Camera View;
  "Show OpenCV motion mask" displays the raw mask. The first ~3 s are spent learning the background.
- **Trigger** (`experiment/vision/trigger.js`): with "Run only when insects are detected" on, the selected
  output starts after 2 consecutive frames with ≥ N insects and stops after the hold time with none.
  The badge at the bottom-left shows the chain live: `CAM-01 → OpenCV · n detected → Shield RUNNING`.
- The output effects live on render layer 2, so the camera (and OpenCV) never sees them — otherwise the
  shield would trigger itself.
- **Physical rig**: `python/insect_detector.py` is the same pipeline with `cv2` for a real camera,
  including the trigger and an `Output.set()` hook (prints, or sends `ON`/`OFF` over `--serial`).

  ```bash
  pip install opencv-python numpy
  python python/insect_detector.py --source 0 --log detections.csv
  ```

What is real and what is not: the detection is genuine OpenCV running on rendered frames. The insects'
flee reaction is a scripted assumption (toggle "Scripted flee when output runs"), so the demo shows the
control loop working — not that sound repels insects.

## Code layout

```
src/
  config/setup.js            physical spec + derived positions (single source of truth)
  scene/
    Scene.jsx                assembles everything; annotation layer
    Planter.jsx Soil.jsx     cardboard box, soil surface
    Crops.jsx plantGeometry.js  procedural maize, merged into 2 draw calls, wind sway
    fieldLayout.js           plant positions/heights + soil height function (shared)
    Rig.jsx Hardware.jsx     pillars, mast, camera, speakers, sensors, cables
    Dimensions.jsx           measurement lines + labels
    LiveFeed.jsx             render target + HUD panel
    ViewController.jsx       Reset / Top / Side presets with smooth transitions
    Studio.jsx               lights, soft shadows, environment, floor
  experiment/
    experimentConfig.js      speakers (frequency, level, duty, zone), sensors, zones, insects, vision
    Emitters.jsx             shield cuboid / waves / light beam effects from the pillars (visual only)
    SpeakerEmitters.jsx      speakerPose() + speaker axis/tag overlay
    TreatmentZones.jsx       treated vs control overlay with plant counts
    insects/insectModel.js   init/step interface for movement models (NullModel for now)
    vision/frameSource.js    captureFrame() → ImageData from the mast camera, PNG download
    analysis/zoneStats.js    zoneOf(), countByZone(), zoneArea()
```

## Extending toward the experiment

- **Configurable speakers** — set `enabled`, `frequencyHz`, `levelDb`, `dutyCycle` per speaker in
  `experimentConfig.js`. `speakerPose(pillarId)` in `SpeakerEmitters.jsx` gives each horn's world
  position and acoustic axis for a future sound-field model (e.g. inverse-square + directivity +
  air absorption at ultrasonic frequencies). Browser audio cannot reproduce ultrasound, so any
  audio should be a sonified stand-in.
- **Insect movement** — implement a model with `init(config, field)` / `step(state, dt, env)` in
  `insects/insectModel.js`, render agents as an `InstancedMesh`, and register it in `MODELS`.
- **Camera-based observation** — `captureFrame()` returns an `ImageData` from the mast camera; feed
  it to TF.js / ONNX Runtime Web, or POST it to a Python (OpenCV / YOLO) service.
- **Counting and comparison** — project detections to world X/Z and call `countByZone()`;
  divide by `zoneArea()` for densities.

## Scope and limits

This is a geometric and visual model of the physical setup. It contains **no acoustic or light
propagation model and no insect behaviour**, so nothing it renders is evidence that a frequency
repels insects. Any simulated effect you add later will only reflect the rules you code.
Real conclusions need physical trials: treated vs. untreated beds, replication, randomised
placement, acoustic isolation between zones, and calibrated sound-level measurements.
