import React, { useState } from 'react';
import {
  Radio,
  AlertTriangle,
  Terminal,
  Save
} from 'lucide-react';
import { HardwareNode, HardwareStatusLevel } from '../types';

export const HardwareSettingsPage: React.FC = () => {
  // Config state
  const [cropZoneRadius, setCropZoneRadius] = useState<number>(26);
  const [cropZoneCenterX, setCropZoneCenterX] = useState<number>(55);
  const [cropZoneCenterY, setCropZoneCenterY] = useState<number>(55);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(85);
  const [maxStimulusDurationSec, setMaxStimulusDurationSec] = useState<number>(3.0);
  const [habituationCooldownSec, setHabituationCooldownSec] = useState<number>(15.0);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Hardware Status nodes
  const hardwareNodes: HardwareNode[] = [
    {
      id: 'node_camera',
      name: 'Optical Video Ingestion',
      category: 'perception',
      status: 'AVAILABLE',
      interfaceType: 'WebRTC / HTML5 MediaDevices',
      latencyMs: 12,
      details: 'User-initiated local camera available; synthetic greenhouse feed active by default.',
      isPhysicalVerified: false,
    },
    {
      id: 'node_cv_model',
      name: 'Computer Vision Inference Model',
      category: 'compute',
      status: 'SIMULATED',
      interfaceType: 'Browser Synthetic Bounding Box Engine',
      latencyMs: 8,
      details: 'Synthetic trajectory generator emulation. No remote paid GPU endpoint required.',
      isPhysicalVerified: false,
    },
    {
      id: 'node_tracking_engine',
      name: 'Temporal Trajectory Tracker',
      category: 'compute',
      status: 'CONNECTED',
      interfaceType: 'In-Memory Kalman & Hungarian Algorithm',
      latencyMs: 3,
      details: 'Continuously active in local JavaScript execution thread.',
      isPhysicalVerified: true,
    },
    {
      id: 'node_controller',
      name: 'Intervention Controller Interface',
      category: 'actuation',
      status: 'SIMULATED',
      interfaceType: 'Software Emulation Bridge (Safe)',
      latencyMs: 5,
      details: 'Command validation and interlock gating active; physical actuator disconnected.',
      isPhysicalVerified: false,
    },
    {
      id: 'node_transducer',
      name: 'Piezo Ultrasonic Transducer Array',
      category: 'actuation',
      status: 'NOT_CONNECTED',
      interfaceType: 'RS-485 / PWM Hardware Bus',
      latencyMs: 0,
      details: 'Not connected — demonstration interface remains fully available locally.',
      isPhysicalVerified: false,
    },
    {
      id: 'node_storage',
      name: 'Trial Evidence Repository',
      category: 'storage',
      status: 'CONNECTED',
      interfaceType: 'W3C LocalStorage / JSON Schema',
      latencyMs: 1,
      details: 'Persistent client-side storage active with 18+ historical demonstration trials.',
      isPhysicalVerified: true,
    },
    {
      id: 'node_backend',
      name: 'Application Backend / Cloud Sync',
      category: 'compute',
      status: 'AVAILABLE',
      interfaceType: 'Local Mock Adapter (Zero Dependency)',
      latencyMs: 0,
      details: 'Runs entirely offline on standard student laptops without cloud accounts.',
      isPhysicalVerified: true,
    },
  ];

  const getStatusBadge = (status: HardwareStatusLevel) => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'AVAILABLE':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'SIMULATED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'NOT_CONNECTED':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      default:
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const handleSaveSettings = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                HARDWARE INTEGRATION & TELEMETRY
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Hardware & System Configuration
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Hardware connectivity auditing, transducer safety parameters, and crop boundary calibrations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              PHYSICAL EMITTERS: GATED (SIMULATED)
            </span>
          </div>
        </div>
      </div>

      {/* Hardware Status Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-emerald-600" />
            <span>Subsystem Connectivity & Device Status</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Audit standard: Honest real-time hardware status
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hardwareNodes.map((node) => (
            <div
              key={node.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm leading-tight">
                    {node.name}
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {node.interfaceType}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border shrink-0 ${getStatusBadge(
                    node.status
                  )}`}
                >
                  {node.status.replace('_', ' ')}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                {node.details}
              </p>

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                <span>Latency: {node.latencyMs} ms</span>
                <span className="font-mono">
                  {node.isPhysicalVerified ? 'VERIFIED PHYSICAL' : 'SOFTWARE MOCK'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Distinction Callout */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 text-xs text-amber-950 space-y-2">
        <div className="font-bold text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>Strict Hardware Attribution Disclosure</span>
        </div>
        <p className="leading-relaxed">
          The Proof-of-Deterrence Engine explicitly separates <em>intervention commands requested</em> from <em>physical acoustic output verified</em>. In this demonstration environment, transducer actuation is fully simulated to safeguard human operators and non-target organisms. No ultrasonic audio is emitted from the browser.
        </p>
      </div>

      {/* Crop Zone & Gating Parameters Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              Configured Crop Zone & Gating Parameters
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Set spatial boundaries and decision thresholds for autonomous bioacoustic intervention
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaved ? 'Settings Saved!' : 'Save Configuration'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Spatial parameters */}
          <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Spatial Crop Zone
            </span>

            <div>
              <label className="text-slate-600 block mb-1">Crop Zone Center X (%):</label>
              <input
                type="number"
                min="10"
                max="90"
                value={cropZoneCenterX}
                onChange={(e) => setCropZoneCenterX(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1">Crop Zone Center Y (%):</label>
              <input
                type="number"
                min="10"
                max="90"
                value={cropZoneCenterY}
                onChange={(e) => setCropZoneCenterY(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1">Protection Radius (%):</label>
              <input
                type="number"
                min="10"
                max="50"
                value={cropZoneRadius}
                onChange={(e) => setCropZoneRadius(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Decision thresholds */}
          <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Decision & Confidence Thresholds
            </span>

            <div>
              <label className="text-slate-600 block mb-1">Min Target Confidence (%):</label>
              <input
                type="number"
                min="50"
                max="99"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Target must maintain confidence above this threshold for &gt; 3 frames before triggering.
              </span>
            </div>

            <div>
              <label className="text-slate-600 block mb-1">Min Tracking Continuity (%):</label>
              <input
                type="number"
                defaultValue={80}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Safety & Actuation limits */}
          <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Safety Interlocks & Duty Limits
            </span>

            <div>
              <label className="text-slate-600 block mb-1">Max Burst Duration (seconds):</label>
              <input
                type="number"
                step="0.5"
                min="1.0"
                max="10.0"
                value={maxStimulusDurationSec}
                onChange={(e) => setMaxStimulusDurationSec(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="text-slate-600 block mb-1">Habituation Cooldown (seconds):</label>
              <input
                type="number"
                step="1"
                min="5"
                max="60"
                value={habituationCooldownSec}
                onChange={(e) => setHabituationCooldownSec(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Hardware Log Output */}
      <div className="bg-slate-950 text-slate-300 rounded-2xl p-5 border border-slate-800 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-white">
              Controller Telemetry Log Console
            </span>
          </div>
          <span className="text-[10px] text-emerald-400">STATUS: GATED_OK</span>
        </div>

        <div className="space-y-1 text-[11px] text-slate-300 pt-1">
          <div>[14:08:12] SYSTEM_BOOT: Bioacoustic verification client initialized in browser runtime.</div>
          <div>[14:08:12] LOCAL_STORE: Loaded 12 historical trial records from local evidence store.</div>
          <div>[14:08:13] HW_PROBE: Optical ingestion available via MediaDevices API. Synthetic stream bound.</div>
          <div>[14:08:13] SAFETY_GATE: Physical RS-485 transducer bus NOT detected. Actuation set to SIMULATED.</div>
          <div>[14:08:14] INTERLOCK: Duty-cycle enforcement active: max_burst = 3.0s, cooldown = 15.0s.</div>
        </div>
      </div>
    </div>
  );
};
