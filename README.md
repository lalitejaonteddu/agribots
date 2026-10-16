# AI TO BOTS — The Proof-of-Deterrence Engine

> **"Don't just repel pests. Prove what works."**  
> *Evidence-Aware Bioacoustic Crop Protection*

---

## 1. Executive Overview

Conventional automated pest-deterrence systems operate as open-loop actuators: once a sensor triggers, a repellent (such as ultrasound, light, or spray) is activated. Crucially, **activation alone does not prove behavioral deterrence**, nor does it establish agricultural efficacy.

**AI to Bots** introduces the **Proof-of-Deterrence Engine**: a closed-loop, evidence-governed cyber-physical platform designed to:
1. **OBSERVE**: Continuously ingest optical greenhouse video feeds and isolate candidate insect targets (e.g. tympanate moth pests such as *Helicoverpa armigera*, *Spodoptera frugiperda*, and *Plutella xylostella*).
2. **IDENTIFY & TRACK**: Compute multi-frame flight trajectories, instantaneous bearings, velocities, and tracking confidence vectors.
3. **DECIDE**: Project target headings against configured Crop Protection Zones, triggering interventions only when intrusion criteria and confidence thresholds are satisfied.
4. **INTERVENE**: Issue structured bioacoustic stimulus requests (e.g., 28–44 kHz frequency-modulated chiropteran echolocation pulse sweeps informed by entomological literature).
5. **VERIFY**: Continue tracking target motion in the critical 3–5 second post-intervention window, measuring angular deflection and canopy exit dynamics.
6. **LEARN FROM EVIDENCE**: Systematically classify outcomes (*Response Observed*, *No Response Observed*, or *Inconclusive*) and update the historical evidence repository to inform subsequent decisions.

---

## 2. Scientific & Technical Grounding

This prototype adheres to strict experimental and scientific credibility standards:
- **Detection $\neq$ Biological Deterrence**: High visual detection confidence measures sensor accuracy, not repellent efficacy.
- **Intervention Request $\neq$ Physical Actuation**: Gated software commands are distinct from confirmed acoustic transducer output.
- **Correlation $\neq$ Proven Causation**: An observed directional change is labeled as a single-encounter behavioral observation. Establishing biological causation requires comparison with silent control baselines.
- **Tracking Loss is NEVER Deterrence**: When a target disappears behind foliage or structural occlusion, the engine rigorously classifies the trial as **INCONCLUSIVE**, actively preventing false-positive deterrence claims.
- **Behavioral Response $\neq$ Yield Guarantee**: Flight deflection demonstrates acute behavioral modification; long-term oviposition reduction and crop yield improvement require multi-week field trials.

---

## 3. Technology Stack

- **Frontend Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 (scientific control dashboard aesthetic, deep forest-green palette, warm light backgrounds)
- **Icons**: Lucide React
- **Analytical Visualizations**: Recharts (proximity time series, deflection histograms, outcome distribution donuts)
- **Perception Visualization**: Interactive SVG Vector Canvas with HUD reticles, trajectory trails, crop zone perimeters, and optional user-initiated WebRTC camera stream
- **Local Persistence**: Browser LocalStorage engine pre-seeded with 12+ realistic, diverse experimental trials
- **Data Export**: Native client-side CSV and JSON export engines

---

## 4. Getting Started & Development

The application is completely self-contained and runs on a standard laptop without requiring GPUs, external hardware, API keys, or cloud accounts.

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation & Run

```bash
# 1. Clone repository and navigate to folder
cd agribots

# 2. Install dependencies (if not already installed)
npm install

# 3. Start development server
npm run dev
```

Open your browser at the displayed local URL (typically `http://localhost:5173/`).

### Production Build & Linting

```bash
# Verify code quality
npm run lint

# Compile production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 5. Demonstration Navigation & Key Screens

The persistent sidebar gives access to 6 specialized operational views:

### 1. Command Center (`/command-center`)
- **Top KPIs**: Targets Observed, Interventions Requested, Responses Observed, and Inconclusive Trials from labeled demonstration records.
- **Live Observation Field**: Interactive greenhouse canopy vector display with animated moth flight, bounding box HUD, real-time bearing vector, and transducer pulse rings.
- **Evidence Status**: Real-time 4-step pipeline progress stepper (`OBSERVE` $\rightarrow$ `DECIDE` $\rightarrow$ `INTERVENE` $\rightarrow$ `VERIFY`), pre/post baselines, and scientific outcome classification cards.
- **Chronological Event Timeline**: Real elapsed-time event log with category filter pills (Observation, Decision, Intervention, Outcome, System).

### 2. Live Observation HUD (`/live-observation`)
- Dedicated multi-frame perception and temporal tracking interface.
- Working playback controls: Start, Pause, Resume, Stop, and Reset.
- Layer toggles: Trajectory trails, Crop Zone boundary, and Grid HUD.
- Explicit user-initiated camera toggle (`navigator.mediaDevices.getUserMedia`) with synthetic overlay.
- Configurable trajectory behaviors: Avoidance Turn Away, Persistent Intrusion, Occlusion & Lost Track, and Spontaneous Control Turn.
- Target telemetry panel: Species catalog metadata, sensory organ notes, bearing, velocity, and frame counters.

### 3. Intervention Lab (`/intervention-lab`)
- Selectable experimental conditions:
  - **Condition A (Silent Control)**: Passive baseline observation with zero acoustic emission.
  - **Condition B (Fixed Acoustic Treatment)**: Pre-scheduled timer-based emission testing habituation risks.
  - **Condition C (AI-Controlled Intervention)**: Context-aware, spatial-threat-gated acoustic intervention.
- Interactive configuration: Target species, bioacoustic profiles (Bat FM Sweep, Staccato Burst, Broadband Flutter), tracking quality thresholds, and pre/post windows.
- **RUN INTERACTIVE TRIAL**: Launches the deterministic simulation, computes actual deflection angles and time in crop zone, classifies evidence, and allows one-click saving to the Evidence Store.

### 4. Evidence Explorer (`/evidence-explorer`)
- **Comparative Condition Matrix**: Table contrasting Silent Control, Fixed Acoustic, and AI-Controlled conditions across trial counts, response rates, deflection angles, and inconclusive rates.
- **Analytical Charts**:
  - Distance to Crop Zone Over Time (comparative curves)
  - Angular Deflection by Condition (bar chart)
  - Outcome Breakdown (pie donut chart)
- **Evidence Interpretation**: Nuanced scientific assessment highlighting why silent controls are required to account for natural moth flight tortuosity.
- **Export Engines**: Instant downloads of complete trial history in CSV or JSON.

### 5. System Architecture (`/system-architecture`)
- Interactive 6-stage engineering diagram:
  1. Perception Pipeline
  2. Temporal Tracking Engine
  3. Evidence-Gated Decision Engine
  4. Intervention Controller Interface
  5. Response Evaluation Engine
  6. Evidence Store & Analytics
- Clickable stage cards opening a deep-dive slide-over inspector detailing inputs, outputs, algorithms, failure modes, and closed-loop roles.
- Closed-loop feedback diagram showing how Stage 5 evaluations recalibrate Stage 3 decision rules.

### 6. Hardware & Settings (`/hardware-settings`)
- Device status grid auditing 7 subsystems: Optical Camera, CV Inference Model, Tracking Engine, Controller Interface, Transducer Array, Storage, and Backend.
- Clear distinction between *Intervention Requested (Simulated)* and *Physical Output Verified*.
- Calibration inputs for Crop Zone coordinates, protection radius, detection thresholds, burst limits, and habituation cooldowns.
- Simulated controller telemetry console.

---

## 6. Built-In 90-Second Judge Demonstration Mode

A prominent **"START JUDGE DEMO"** button is pinned to the header. Clicking it opens a guided 6-stage walkthrough engineered specifically for hackathon judging:
- **Step 1 — Detect**: Visual candidate target identified, multi-frame track established.
- **Step 2 — Decide**: Decision engine projects threat vector against crop boundary.
- **Step 3 — Intervene**: Simulated bioacoustic request dispatched (with honest simulation disclaimer).
- **Step 4 — Verify**: Target movement tracked post-intervention; deflection measured.
- **Step 5 — Classify**: Rigorous outcome assignment (*Response Observed* vs *Inconclusive*).
- **Step 6 — Compare**: Cross-condition comparison in Evidence Explorer.

Judges can toggle deterministic scenarios directly inside the walkthrough to verify that tracking loss is never falsely claimed as successful deterrence.

---

## 7. Hardware & Simulation Status Matrix

| Subsystem | Operational Status in Demo | Physical Deployment Requirement |
| :--- | :--- | :--- |
| **Video Acquisition** | Available (HTML5 MediaDevices / Synthetic) | IP/RTSP Greenhouse Camera |
| **CV Inference** | Simulated (Synthetic Vector Engine) | Edge ONNX/TensorRT Moth Detector |
| **Temporal Tracker** | Connected (In-Browser Kalman Filter) | Embedded Tracker Node |
| **Intervention Gate** | Simulated (Interlock Software Bridge) | Microcontroller GPIO/DAC Bridge |
| **Acoustic Transducer**| Not Connected (Gated Safe Mode) | Ultrasonic Piezo Emitter Array (20–55 kHz) |
| **Evidence Store** | Connected (Browser LocalStorage) | Local SQLite / Edge MQTT TimeSeries DB |
| **Cloud Backend** | Offline Mock Adapter | REST / GraphQL Synchronization Gateway |

---

## 8. License & Attribution

Developed for hackathon evaluation under the **AI TO BOTS** project initiative.  
Literature bioacoustic profiles informed by:
- Waters, D.A. & Jones, G. (1995) *Echolocation call structure and moth hearing thresholds*.
- Roeder, K.D. (1967) *Nerve cells and insect behavior*.
- Spangler, H.G. (1988) *Moth hearing, defense sounds, and ultrasound deterrence in agriculture*.
