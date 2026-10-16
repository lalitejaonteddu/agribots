import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { PestTarget, SystemStage } from '../../types';

interface ObservationCanvasProps {
  target: PestTarget | null;
  cropZone: { x: number; y: number; radius: number };
  emitter: { x: number; y: number; isActive: boolean; pulseCount: number };
  stage: SystemStage;
  elapsedMs: number;
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  customOverlayTitle?: string;
}

export const ObservationCanvas: React.FC<ObservationCanvasProps> = ({
  target,
  cropZone,
  emitter,
  stage,
  elapsedMs,
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
  onReset,
  customOverlayTitle = 'Greenhouse Bay 04 &middot; Camera Stream 01-A'
}) => {
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showZone, setShowZone] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [useWebcam, setUseWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Manage webcam lifecycle explicitly on user demand
  useEffect(() => {
    if (useWebcam) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 1280, height: 720 } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setWebcamError(null);
        })
        .catch((err) => {
          console.warn('Webcam permission denied or unavailable', err);
          setWebcamError('Camera access declined or unavailable on this device.');
          setUseWebcam(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useWebcam]);

  // Stage color scheme
  const stageColors: Record<SystemStage, { border: string; bg: string; text: string }> = {
    IDLE: { border: 'border-slate-300', bg: 'bg-slate-100', text: 'text-slate-600' },
    OBSERVE: { border: 'border-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-700' },
    DECIDE: { border: 'border-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-700' },
    INTERVENE: { border: 'border-purple-400', bg: 'bg-purple-500/10', text: 'text-purple-700' },
    VERIFY: { border: 'border-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-700' },
    EVALUATE: { border: 'border-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-800' }
  };

  const currentStageStyle = stageColors[stage];

  // Convert percentage coordinates (0-100) to SVG viewBox units (0-1000 x 0-600)
  const toSvgX = (pct: number) => (pct / 100) * 1000;
  const toSvgY = (pct: number) => (pct / 100) * 600;

  // Build SVG path for trajectory trail
  const trajectoryPath =
    target && target.trajectory.length > 1
      ? target.trajectory
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toSvgX(pt.x)} ${toSvgY(pt.y)}`)
          .join(' ')
      : '';

  // Distance from target to crop zone edge
  const targetDistToCrop = target
    ? Math.max(0, Math.hypot(target.x - cropZone.x, target.y - cropZone.y) - cropZone.radius).toFixed(1)
    : '—';

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-lg flex flex-col text-slate-200 relative select-none">
      {/* Canvas Top Bar HUD */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono font-semibold tracking-wider text-emerald-400">
              {useWebcam ? 'LIVE CAMERA [OVERLAY MODE]' : 'SYNTHETIC CANOPY FEED'}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-xs text-slate-400">{customOverlayTitle}</span>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          {target && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono">
              <span className="text-slate-400">TRACK:</span>
              <span
                className={`font-semibold ${
                  target.trackingQuality === 'optimal'
                    ? 'text-emerald-400'
                    : target.trackingQuality === 'degraded'
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {target.trackingQuality.toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
            <span className="text-slate-400">T:</span>
            <span>{(elapsedMs / 1000).toFixed(2)}s</span>
          </div>
        </div>
      </div>

      {/* Main Visual Display Area */}
      <div className="relative w-full aspect-video bg-[#0d1410] overflow-hidden flex items-center justify-center">
        {/* Optional webcam video stream background */}
        {useWebcam && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover opacity-45 filter contrast-125"
          />
        )}

        {/* SVG Synthetic Vector Observation Overlay */}
        <svg
          viewBox="0 0 1000 600"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="cropGrid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(16, 185, 129, 0.07)" strokeWidth="1" />
            </pattern>

            {/* Transducer gradient */}
            <radialGradient id="transducerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#0284c7" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
            </radialGradient>

            {/* Crop zone gradient */}
            <radialGradient id="cropZoneGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="80%" stopColor="#059669" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.01" />
            </radialGradient>

            {/* Acoustic pulse wave animation gradient */}
            <radialGradient id="acousticWave" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
              <stop offset="60%" stopColor="#c084fc" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0.8" />
            </radialGradient>
          </defs>

          {/* Grid lines */}
          {showGrid && <rect width="1000" height="600" fill="url(#cropGrid)" />}

          {/* Greenhouse architectural framing lines */}
          <g stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1">
            <line x1="0" y1="120" x2="1000" y2="120" />
            <line x1="0" y1="480" x2="1000" y2="480" />
            <line x1="250" y1="0" x2="250" y2="600" />
            <line x1="750" y1="0" x2="750" y2="600" />
            {/* Perspective truss lines */}
            <line x1="0" y1="0" x2="500" y2="150" />
            <line x1="1000" y1="0" x2="500" y2="150" />
          </g>

          {/* Simulated Crop rows in background (Tomatoes / Cotton canopy) */}
          <g opacity="0.4">
            {/* Canopy row 1 */}
            <ellipse cx="450" cy="380" rx="220" ry="80" fill="#064e3b" opacity="0.6" />
            <ellipse cx="620" cy="390" rx="210" ry="75" fill="#065f46" opacity="0.5" />
            <ellipse cx="530" cy="420" rx="240" ry="90" fill="#047857" opacity="0.4" />
            {/* Decorative leaf motifs */}
            <circle cx="480" cy="360" r="14" fill="#10b981" opacity="0.3" />
            <circle cx="560" cy="380" r="16" fill="#10b981" opacity="0.3" />
            <circle cx="430" cy="400" r="12" fill="#10b981" opacity="0.3" />
          </g>

          {/* Simulated Obstacle / Foliage cluster (for Scenario 3 occlusion) */}
          <g opacity="0.75">
            <rect
              x="530"
              y="220"
              width="140"
              height="180"
              rx="12"
              fill="rgba(15, 23, 42, 0.85)"
              stroke="rgba(71, 85, 105, 0.4)"
              strokeDasharray="4 4"
            />
            <text x="545" y="245" fill="#94a3b8" fontSize="11" fontFamily="monospace">
              [OCCLUSION ZONE]
            </text>
            <text x="545" y="262" fill="#64748b" fontSize="10">
              Dense Truss / Blindspot
            </text>
          </g>

          {/* Configured Crop Zone Perimeter */}
          {showZone && (
            <g>
              <circle
                cx={toSvgX(cropZone.x)}
                cy={toSvgY(cropZone.y)}
                r={toSvgX(cropZone.radius)}
                fill="url(#cropZoneGlow)"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="8 6"
                className="animate-pulse"
              />
              {/* Zone label */}
              <text
                x={toSvgX(cropZone.x) - 70}
                y={toSvgY(cropZone.y) - toSvgX(cropZone.radius) - 10}
                fill="#34d399"
                fontSize="12"
                fontFamily="monospace"
                fontWeight="bold"
              >
                CONFIGURED CROP PROTECTION ZONE
              </text>
            </g>
          )}

          {/* Bioacoustic Transducer Emitter Beacon */}
          <g>
            <circle
              cx={toSvgX(emitter.x)}
              cy={toSvgY(emitter.y)}
              r="24"
              fill="url(#transducerGlow)"
              stroke="#0284c7"
              strokeWidth="2"
            />
            <circle
              cx={toSvgX(emitter.x)}
              cy={toSvgY(emitter.y)}
              r="6"
              fill={emitter.isActive ? '#a855f7' : '#38bdf8'}
            />
            <text
              x={toSvgX(emitter.x) - 58}
              y={toSvgY(emitter.y) - 30}
              fill="#38bdf8"
              fontSize="11"
              fontFamily="monospace"
            >
              TRANSDUCER TX-01
            </text>

            {/* Active Acoustic Emission Wave Pulses */}
            {emitter.isActive && (
              <g stroke="#c084fc" fill="none">
                <circle
                  cx={toSvgX(emitter.x)}
                  cy={toSvgY(emitter.y)}
                  r="50"
                  strokeWidth="2.5"
                  opacity="0.8"
                  className="animate-ping"
                />
                <circle
                  cx={toSvgX(emitter.x)}
                  cy={toSvgY(emitter.y)}
                  r="95"
                  strokeWidth="2"
                  opacity="0.6"
                  strokeDasharray="6 4"
                />
                <circle
                  cx={toSvgX(emitter.x)}
                  cy={toSvgY(emitter.y)}
                  r="150"
                  strokeWidth="1.5"
                  opacity="0.4"
                  strokeDasharray="10 8"
                />
              </g>
            )}
          </g>

          {/* Trajectory history path */}
          {showTrajectory && trajectoryPath && (
            <path
              d={trajectoryPath}
              fill="none"
              stroke="rgba(56, 189, 248, 0.75)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 2"
            />
          )}

          {/* Pest Target Overlay */}
          {target && target.trackingQuality !== 'lost' && (
            <g
              transform={`translate(${toSvgX(target.x)}, ${toSvgY(target.y)})`}
              className="transition-all duration-75"
            >
              {/* Distance line to Crop Zone */}
              <line
                x1="0"
                y1="0"
                x2={toSvgX(cropZone.x - target.x)}
                y2={toSvgY(cropZone.y - target.y)}
                stroke="rgba(245, 158, 11, 0.4)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Bounding Box Reticle */}
              <rect
                x="-22"
                y="-22"
                width="44"
                height="44"
                fill="rgba(56, 189, 248, 0.08)"
                stroke={target.status === 'deterred' ? '#10b981' : '#38bdf8'}
                strokeWidth="1.5"
                rx="4"
              />

              {/* Corner brackets for HUD feel */}
              <path
                d="M -22 -14 L -22 -22 L -14 -22 M 14 -22 L 22 -22 L 22 -14 M 22 14 L 22 22 L 14 22 M -14 22 L -22 22 L -22 14"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
              />

              {/* Moth Silhouette Icon */}
              <g transform="scale(0.8) translate(-12, -12)">
                <path
                  d="M12 4 C14 8, 18 10, 22 7 C20 14, 16 16, 13 15 L13 21 L11 21 L11 15 C8 16, 4 14, 2 7 C6 10, 10 8, 12 4 Z"
                  fill={target.status === 'deterred' ? '#34d399' : '#f8fafc'}
                  opacity="0.9"
                />
                <circle cx="12" cy="11" r="2.5" fill="#f59e0b" />
              </g>

              {/* Target Data Tag */}
              <g transform="translate(28, -26)">
                <rect
                  x="0"
                  y="0"
                  width="180"
                  height="36"
                  rx="6"
                  fill="rgba(15, 23, 42, 0.92)"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <text x="8" y="14" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">
                  [{target.id}] {target.species}
                </text>
                <text x="8" y="27" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                  CONF: {(target.confidence * 100).toFixed(0)}% &middot; V: {Math.hypot(target.vx, target.vy).toFixed(1)} px/s
                </text>
              </g>
            </g>
          )}

          {/* Lost Target State */}
          {target && target.trackingQuality === 'lost' && (
            <g transform={`translate(${toSvgX(target.x)}, ${toSvgY(target.y)})`}>
              <rect
                x="-25"
                y="-25"
                width="50"
                height="50"
                fill="rgba(239, 68, 68, 0.15)"
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="4 4"
                rx="6"
              />
              <line x1="-20" y1="-20" x2="20" y2="20" stroke="#ef4444" strokeWidth="2" />
              <line x1="20" y1="-20" x2="-20" y2="20" stroke="#ef4444" strokeWidth="2" />
              <text x="-45" y="40" fill="#f87171" fontSize="11" fontFamily="monospace" fontWeight="bold">
                TRACKING LOST (INCONCLUSIVE)
              </text>
            </g>
          )}
        </svg>

        {/* Empty / Idle State Overlay */}
        {!isRunning && !target && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-xs z-20 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
              <Eye className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-white">Observation Engine Ready</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Start an interactive encounter to track moth flight paths, evaluate crop zone intrusion, and test bioacoustic deterrence.
            </p>
            <button
              onClick={onStart}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs shadow-md transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>START DEMO ENCOUNTER</span>
            </button>
          </div>
        )}

        {/* Active Stage Pill in bottom-left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10">
          <div className={`px-2.5 py-1 rounded-md border text-xs font-mono font-bold uppercase backdrop-blur-md ${currentStageStyle.bg} ${currentStageStyle.border} ${currentStageStyle.text}`}>
            STAGE: {stage}
          </div>
          {target && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-700/80 text-[11px] font-mono text-slate-300">
              <span>DIST TO CROP:</span>
              <span className="font-bold text-amber-400">{targetDistToCrop}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="bg-slate-900 px-4 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Playback controls */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Start Encounter</span>
            </button>
          ) : isPaused ? (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Resume</span>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Visual Layer Toggles */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showTrajectory}
              onChange={(e) => setShowTrajectory(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Trajectory</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showZone}
              onChange={(e) => setShowZone(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Crop Zone</span>
          </label>

          <label className="hidden sm:flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <span>Grid HUD</span>
          </label>

          {/* Explicit User-Initiated Camera Input Button */}
          <button
            onClick={() => setUseWebcam(!useWebcam)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors cursor-pointer ${
              useWebcam
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Toggle user-initiated webcam stream (simulated pest overlay)"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{useWebcam ? 'Webcam On' : 'Use Webcam'}</span>
          </button>
        </div>
      </div>

      {/* Webcam error warning if denied */}
      {webcamError && (
        <div className="bg-red-950/80 border-t border-red-800 px-4 py-1.5 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{webcamError} Reverted to synthetic vector canvas.</span>
          </div>
          <button
            onClick={() => setWebcamError(null)}
            className="text-red-400 hover:text-red-200 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
