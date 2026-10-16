import React, { useState } from 'react';
import {
  Crosshair,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Square,
} from 'lucide-react';
import { ObservationCanvas } from '../components/observation/ObservationCanvas';
import { TargetInfoCard } from '../components/observation/TargetInfoCard';
import { PestSimulationEngine, SimulationState } from '../services/simulationEngine';
import { PEST_CATALOG } from '../data/pestCatalog';
import { DeterministicScenario } from '../types';

interface LiveObservationPageProps {
  simulationState: SimulationState;
  simulationEngine: PestSimulationEngine;
}

export const LiveObservationPage: React.FC<LiveObservationPageProps> = ({
  simulationState,
  simulationEngine,
}) => {
  const { target, stage, elapsedMs, isRunning, isPaused, emitter, cropZone } = simulationState;
  const [selectedSpecies, setSelectedSpecies] = useState('Helicoverpa armigera');
  const [selectedTrajectoryBehavior, setSelectedTrajectoryBehavior] =
    useState<DeterministicScenario>('SCENARIO_1_AVOIDANCE');

  const handleStartObservation = (scenarioOverride?: DeterministicScenario) => {
    simulationEngine.startTrial(
      'AI_CONTROLLED',
      scenarioOverride || selectedTrajectoryBehavior,
      selectedSpecies
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                TEMPORAL TRACKING & PERCEPTION
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Live Observation HUD
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Real-time multi-frame perception, coordinate bounding, and trajectory continuity monitoring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono font-medium border border-slate-200">
              STREAM: 1080p @ 30 FPS SYNTHETIC
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout: Large Canvas (8 cols) and Telemetry + Trajectory Behavior Controller (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Large Observation Canvas */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Target Perception Field & Boundary Projection
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                RESOLUTION: 1000x600 px VIRTUAL COORD
              </span>
            </div>

            <ObservationCanvas
              target={target}
              cropZone={cropZone}
              emitter={emitter}
              stage={stage}
              elapsedMs={elapsedMs}
              isRunning={isRunning}
              isPaused={isPaused}
              onStart={() => handleStartObservation()}
              onPause={() => simulationEngine.pauseTrial()}
              onResume={() => simulationEngine.resumeTrial()}
              onReset={() => simulationEngine.reset()}
              customOverlayTitle="Live Crop Sector 02 — High Speed Optical Tracking"
            />

            {/* Perception Control Toolbar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStartObservation()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Tracking</span>
                </button>

                {isRunning && (
                  <>
                    {isPaused ? (
                      <button
                        onClick={() => simulationEngine.resumeTrial()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Resume</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => simulationEngine.pauseTrial()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}
                    <button
                      onClick={() => simulationEngine.stopTrial()}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => simulationEngine.reset()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Tracking</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                STAGE: <strong className="text-slate-800">{stage}</strong> &middot; TIME: <strong className="text-slate-800">{(elapsedMs / 1000).toFixed(1)}s</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry & Trajectory Behavior Modes (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <TargetInfoCard target={target} elapsedMs={elapsedMs} />

          {/* Configurable Trajectory Scenarios */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Flight Trajectory Behaviors
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Select or test specific moth flight dynamics to demonstrate how the temporal tracking pipeline handles diverse flight paths:
            </p>

            <div className="space-y-2 text-xs">
              <button
                onClick={() => {
                  setSelectedTrajectoryBehavior('SCENARIO_1_AVOIDANCE');
                  handleStartObservation('SCENARIO_1_AVOIDANCE');
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedTrajectoryBehavior === 'SCENARIO_1_AVOIDANCE'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>1. Avoidance Turn Away</span>
                  <span className="text-[10px] text-emerald-700 font-normal">Active Deflection</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Target approaches crop zone, then sharply alters heading &gt;120° upon bioacoustic pulse.
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedTrajectoryBehavior('SCENARIO_2_NO_RESPONSE');
                  handleStartObservation('SCENARIO_2_NO_RESPONSE');
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedTrajectoryBehavior === 'SCENARIO_2_NO_RESPONSE'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>2. Persistent Intrusion</span>
                  <span className="text-[10px] text-red-700 font-normal">No Response</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Target persists straight into the crop zone, ignoring bioacoustic emission.
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedTrajectoryBehavior('SCENARIO_3_TRACKING_LOST');
                  handleStartObservation('SCENARIO_3_TRACKING_LOST');
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedTrajectoryBehavior === 'SCENARIO_3_TRACKING_LOST'
                    ? 'bg-amber-50 border-amber-300 text-amber-950 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>3. Occlusion & Lost Track</span>
                  <span className="text-[10px] text-amber-700 font-normal">Inconclusive</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Target flies behind greenhouse truss foliage. Demonstrates why lost tracking is NOT deterrence.
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedTrajectoryBehavior('SCENARIO_4_CONTROL_TURNS');
                  handleStartObservation('SCENARIO_4_CONTROL_TURNS');
                }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                  selectedTrajectoryBehavior === 'SCENARIO_4_CONTROL_TURNS'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>4. Spontaneous Control Turn</span>
                  <span className="text-[10px] text-blue-700 font-normal">Natural Baseline</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Target deviates path naturally without any sound, demonstrating why control trials matter.
                </div>
              </button>
            </div>
          </div>

          {/* Target Species Selector */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2 text-xs">
            <label className="font-bold uppercase tracking-wider text-slate-700 block text-[11px]">
              Target Insect Species Catalog:
            </label>
            <select
              value={selectedSpecies}
              onChange={(e) => setSelectedSpecies(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-emerald-600"
            >
              {PEST_CATALOG.map((p) => (
                <option key={p.id} value={p.scientificName}>
                  {p.scientificName} ({p.commonName})
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
              <strong>Sensory Organ:</strong>{' '}
              {PEST_CATALOG.find((p) => p.scientificName === selectedSpecies)?.acousticSensoryOrgan}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
