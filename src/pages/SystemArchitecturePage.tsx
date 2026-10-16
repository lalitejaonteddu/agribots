import React, { useState } from 'react';
import {
  Eye,
  Crosshair,
  Brain,
  Volume2,
  LineChart,
  Database,
  RotateCcw,
  Radio,
} from 'lucide-react';
import { ArchitectureDrawer } from '../components/architecture/ArchitectureDrawer';
import { ArchitectureStage } from '../types';

export const SystemArchitecturePage: React.FC = () => {
  const [selectedStage, setSelectedStage] = useState<ArchitectureStage | null>(null);

  const architectureStages: ArchitectureStage[] = [
    {
      id: 'stage_1_perception',
      stepNumber: 1,
      title: 'Perception Pipeline',
      subtitle: 'Camera acquisition & candidate target detection',
      description:
        'Continuous frame ingestion at 30+ FPS. Employs lightweight bounding box detection or optical flow to isolate flying insect candidate centroids against complex greenhouse vegetation backgrounds.',
      inputs: ['1080p RGB video stream from bay camera', 'Ambient illumination calibration data'],
      outputs: ['Candidate target bounding boxes [x, y, w, h]', 'Instantaneous detection confidence [0.0 - 1.0]'],
      algorithms: ['Temporal differencing & optical flow', 'Edge-optimized spatial centroid extraction'],
      failureModes: [
        'Rapid lighting shifts causing false motion blobs',
        'Foliage flutter from ventilation fans'
      ],
      feedbackRole: 'Receives spatial ROI priority masking from Decision Engine to conserve compute.'
    },
    {
      id: 'stage_2_tracking',
      stepNumber: 2,
      title: 'Temporal Tracking Engine',
      subtitle: 'Multi-frame trajectory & velocity estimation',
      description:
        'Maintains target identity across frames using temporal filtering. Filters out momentary spurious detections and computes velocity vectors, flight tortuosity, and continuous tracking quality scores.',
      inputs: ['Sequential detection centroids', 'Inter-frame delta timestamps (dt)'],
      outputs: ['Persistent Target Track ID', 'Instantaneous bearing (degrees) & velocity (px/s)', 'Tracking continuity score (% frames tracked)'],
      algorithms: ['Kalman filtering / Hungarian association', 'Trajectory polynomial smoothing'],
      failureModes: [
        'Target occlusion behind greenhouse trusses or plant stems',
        'Abrupt flight reversals exceeding motion model gating'
      ],
      feedbackRole: 'Flags tracking discontinuity directly to Response Evaluator to enforce INCONCLUSIVE gating.'
    },
    {
      id: 'stage_3_decision',
      stepNumber: 3,
      title: 'Evidence-Gated Decision Engine',
      subtitle: 'Spatial intrusion rules & stimulus selection',
      description:
        'Projects target heading vector toward the configured Crop Protection Zone. Checks if projected intersection time < 2.5s and confidence > 85%. Selects literature-informed acoustic stimulus profile.',
      inputs: ['Target position & heading vector', 'Configured crop protection zone polygon', 'Historical bioacoustic response efficacy matrix'],
      outputs: ['Intervention Trigger Command', 'Selected acoustic profile ID & duration parameter', 'Decision rationale audit payload'],
      algorithms: ['Vector-to-circle intersection projection', 'Rule-based threshold gating & habituation cooldown timer'],
      failureModes: [
        'Rapid changes in target direction before command execution',
        'Simultaneous multi-target intrusion priority conflicts'
      ],
      feedbackRole: 'Dynamically adapts frequency profiles when past trials show habituation.'
    },
    {
      id: 'stage_4_controller',
      stepNumber: 4,
      title: 'Intervention Controller Interface',
      subtitle: 'Bioacoustic transducer gating & safety limits',
      description:
        'Hardware abstraction layer managing communication with physical or simulated ultrasonic transducer arrays. Enforces strict safety interlocks, duty cycle limits, and thermal throttling.',
      inputs: ['Validated intervention trigger command', 'Acoustic waveform parameters (frequency sweep, intensity dB SPL)'],
      outputs: ['DAC / PWM transducer drive signals', 'Real-time actuation telemetry & confirmation timestamp'],
      algorithms: ['Ultrasonic frequency synthesis (20 - 55 kHz)', 'Hardware watchdog & duty-cycle limiter (max 3s burst)'],
      failureModes: [
        'Transducer driver bus timeout or voltage drop',
        'Acoustic transducer membrane degradation'
      ],
      feedbackRole: 'Confirms whether stimulus was physically generated or safely simulated.'
    },
    {
      id: 'stage_5_evaluation',
      stepNumber: 5,
      title: 'Response Evaluation Engine',
      subtitle: 'Pre vs post-stimulus behavioural quantification',
      description:
        'The core innovation layer: monitors target movement in the critical 3-to-5 second post-intervention window. Compares pre-stimulus velocity vector against post-stimulus flight path to calculate deflection angle and zone departure.',
      inputs: ['Pre-intervention trajectory baseline', 'Post-intervention trajectory window', 'Tracking continuity score during observation'],
      outputs: ['Angular trajectory deviation (degrees)', 'Time spent in crop zone (seconds)', 'Scientific Outcome Classification: RESPONSE / NO RESPONSE / INCONCLUSIVE'],
      algorithms: ['Vector angular delta calculation: arccos(v1 · v2)', 'Strict occlusion gating: if trackQuality < 60% -> INCONCLUSIVE'],
      failureModes: [
        'Ambient wind gusts confounding natural moth flight deflection',
        'Target disappearance falsely interpreted as deterrent success'
      ],
      feedbackRole: 'Feeds measured outcome directly back to Decision Engine to recalibrate efficacy weights!'
    },
    {
      id: 'stage_6_evidence_store',
      stepNumber: 6,
      title: 'Evidence Store & Analytics',
      subtitle: 'Multi-trial repository & scientific audit trail',
      description:
        'Persists structured trial logs with granular timestamps, sensor parameters, trajectory coordinate sequences, and outcome justifications. Enables rigorous comparison between treatment and silent control groups.',
      inputs: ['Complete TrialRecord data objects', 'Environmental and hardware sensor telemetry'],
      outputs: ['Comparative statistical tables', 'Interactive Recharts distribution plots', 'Audited CSV / JSON exports for peer review'],
      algorithms: ['Control-vs-treatment odds-ratio computation', 'Local-first persistent indexed trial store'],
      failureModes: [
        'Data corruption or browser storage quota exhaustion'
      ],
      feedbackRole: 'Provides historical reference distributions for statistical confidence benchmarks.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                SYSTEM ARCHITECTURE & CLOSED-LOOP FLOW
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              From Visual Observation to Evidence-Governed Intervention
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              A closed-loop agricultural cyber-physical architecture integrating computer vision, trajectory tracking, intervention gating, and outcome evaluation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              6 ARCHITECTURAL MODULES
            </span>
          </div>
        </div>
      </div>

      {/* Interactive 6-Stage Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {architectureStages.map((stage) => {
          const icons = [Eye, Crosshair, Brain, Volume2, LineChart, Database];
          const StageIcon = icons[stage.stepNumber - 1];

          return (
            <div
              key={stage.id}
              onClick={() => setSelectedStage(stage)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-lg bg-emerald-900 text-emerald-300 font-bold text-xs flex items-center justify-center font-mono">
                    0{stage.stepNumber}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-700 transition-colors">
                    Click to Inspect &rarr;
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-900 text-slate-700 transition-colors">
                    <StageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-emerald-950 transition-colors">
                      {stage.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{stage.subtitle}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  {stage.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Inputs: {stage.inputs.length}</span>
                <span>Outputs: {stage.outputs.length}</span>
                <span className="text-emerald-700 font-semibold font-mono">STAGE {stage.stepNumber}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed Loop Visual Architecture Diagram */}
      <div className="bg-slate-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
              CLOSED-LOOP CYBER-PHYSICAL FEEDBACK
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Evidence-Aware Closed Loop Architecture
            </h3>
          </div>
          <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800 font-mono">
            FEEDBACK ACTIVE
          </span>
        </div>

        {/* Forward Pipeline Flow */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <Eye className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-[11px]">1. PERCEPTION</span>
            <span className="text-[9px] text-slate-400">Camera / Box</span>
          </div>

          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <Crosshair className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-[11px]">2. TRACKING</span>
            <span className="text-[9px] text-slate-400">Heading & Speed</span>
          </div>

          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <Brain className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-[11px]">3. DECISION</span>
            <span className="text-[9px] text-slate-400">Zone Threat Gating</span>
          </div>

          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <Volume2 className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-[11px]">4. CONTROLLER</span>
            <span className="text-[9px] text-slate-400">Transducer Gate</span>
          </div>

          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <LineChart className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-[11px]">5. RESPONSE</span>
            <span className="text-[9px] text-slate-400">Post-Deflection</span>
          </div>

          <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-1">
            <Database className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-[11px]">6. EVIDENCE</span>
            <span className="text-[9px] text-slate-400">Trial History</span>
          </div>
        </div>

        {/* Feedback Loop Callout */}
        <div className="bg-emerald-950/80 p-4 rounded-xl border border-emerald-800 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-900 text-emerald-400 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <div className="font-bold text-emerald-300">
                Closed-Loop Learning & Habituation Safeguard:
              </div>
              <p className="text-slate-300 text-[11px] mt-0.5">
                Stage 5 (Response Evaluation) feeds outcome evidence back into Stage 3 (Decision Engine). If repeated non-responses are recorded, the engine automatically cycles the ultrasonic waveform to prevent habituation.
              </p>
            </div>
          </div>
          <span className="hidden md:inline font-mono text-[11px] text-emerald-400 bg-emerald-900/60 px-2.5 py-1 rounded border border-emerald-700 shrink-0">
            RESPONSE &rarr; DECISION RECALIBRATION
          </span>
        </div>

        {/* External Hardware Block */}
        <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-300">
              External Hardware Integration Layer:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-mono">
              STATUS: EMULATED / SYNTHETIC TEST HARNESS
            </span>
            <span className="text-slate-400 text-[11px]">
              (No live ultrasound emission from client browser)
            </span>
          </div>
        </div>
      </div>

      {/* Architecture Detail Drawer */}
      <ArchitectureDrawer
        stage={selectedStage}
        onClose={() => setSelectedStage(null)}
      />
    </div>
  );
};
