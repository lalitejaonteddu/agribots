import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Sliders,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { ObservationCanvas } from '../components/observation/ObservationCanvas';
import { PestSimulationEngine, SimulationState } from '../services/simulationEngine';
import { saveTrial } from '../services/storage';
import { PEST_CATALOG, ACOUSTIC_PROFILES } from '../data/pestCatalog';
import {
  ExperimentalCondition,
  DeterministicScenario,
  TrialRecord
} from '../types';

interface InterventionLabPageProps {
  simulationState: SimulationState;
  simulationEngine: PestSimulationEngine;
  onTrialSaved: (trial: TrialRecord) => void;
}

export const InterventionLabPage: React.FC<InterventionLabPageProps> = ({
  simulationState,
  simulationEngine,
  onTrialSaved,
}) => {
  const { target, stage, elapsedMs, isRunning, isPaused, emitter, cropZone, trialResult } =
    simulationState;

  // Experiment Setup Parameters
  const [trialName, setTrialName] = useState<string>('TR-2026-0881');
  const [condition, setCondition] = useState<ExperimentalCondition>('AI_CONTROLLED');
  const [scenario, setScenario] = useState<DeterministicScenario>('SCENARIO_1_AVOIDANCE');
  const [targetSpecies, setTargetSpecies] = useState<string>('Helicoverpa armigera');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('bat_fm_sweep_v1');
  const [minTrackingQuality, setMinTrackingQuality] = useState<number>(80);

  const selectedProfile =
    ACOUSTIC_PROFILES.find((p) => p.id === selectedProfileId) || ACOUSTIC_PROFILES[0];

  const handleRunInteractiveTrial = () => {
    simulationEngine.startTrial(condition, scenario, targetSpecies, trialName);
  };

  const handleSaveToEvidenceStore = () => {
    if (trialResult) {
      saveTrial(trialResult);
      onTrialSaved(trialResult);
      // generate fresh trial name for next trial
      setTrialName(`TR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                SCIENTIFIC EXPERIMENTAL TESTBENCH
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Intervention Lab
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-semibold">
              "Measure the response. Do not assume success."
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Evaluate three experimental conditions under strict control-versus-treatment protocols. Never conflate activation with behavioral deterrence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunInteractiveTrial}
              disabled={isRunning}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
                isRunning
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-800 hover:bg-emerald-900 text-white hover:scale-[1.01]'
              }`}
            >
              <Play className="w-4 h-4 fill-white" />
              <span>RUN INTERACTIVE TRIAL</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Selectable Experimental Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Condition A */}
        <div
          onClick={() => setCondition('SILENT_CONTROL')}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
            condition === 'SILENT_CONTROL'
              ? 'bg-blue-50/70 border-blue-600 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
              CONDITION A
            </span>
            {condition === 'SILENT_CONTROL' && (
              <span className="text-xs font-bold text-blue-700">SELECTED</span>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Silent Control</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            No bioacoustic intervention requested. Measures ambient natural flight baseline and spontaneous turning rates.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
            Acoustic Emitter: <strong className="text-slate-800">OFF (0 dB)</strong>
          </div>
        </div>

        {/* Condition B */}
        <div
          onClick={() => setCondition('FIXED_ACOUSTIC')}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
            condition === 'FIXED_ACOUSTIC'
              ? 'bg-purple-50/70 border-purple-600 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-purple-900 bg-purple-100 px-2 py-0.5 rounded">
              CONDITION B
            </span>
            {condition === 'FIXED_ACOUSTIC' && (
              <span className="text-xs font-bold text-purple-700">SELECTED</span>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Fixed Acoustic Treatment</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Stimulus requested on fixed schedule independently of post-intervention response. Tests for habituation risks.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
            Acoustic Emitter: <strong className="text-slate-800">FIXED TIMER (SIMULATED)</strong>
          </div>
        </div>

        {/* Condition C */}
        <div
          onClick={() => setCondition('AI_CONTROLLED')}
          className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
            condition === 'AI_CONTROLLED'
              ? 'bg-emerald-50/70 border-emerald-600 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
              CONDITION C (PROPOSED)
            </span>
            {condition === 'AI_CONTROLLED' && (
              <span className="text-xs font-bold text-emerald-700">SELECTED</span>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-sm">AI-Controlled Intervention</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Evaluates flight vector, gates stimulus on crop intrusion threat, verifies subsequent trajectory response.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
            Acoustic Emitter: <strong className="text-emerald-800">EVIDENCE-GATED</strong>
          </div>
        </div>
      </div>

      {/* Main Execution View: Left Canvas (7 cols), Right Experiment Config & Results (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Observation Canvas */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Trial Execution Observation Field
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                ACTIVE TRIAL: {trialName}
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
              onStart={handleRunInteractiveTrial}
              onPause={() => simulationEngine.pauseTrial()}
              onResume={() => simulationEngine.resumeTrial()}
              onReset={() => simulationEngine.reset()}
              customOverlayTitle={`Intervention Lab &middot; ${condition}`}
            />

            {/* Trial Stage Banner */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">
                  Pipeline Stage:
                </span>
                <span className="font-bold text-slate-900 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  {stage}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => simulationEngine.reset()}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Test</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Configuration & Result Panel */}
        <div className="lg:col-span-5 space-y-4">
          {/* Configuration Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Experiment Parameters
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">CONFIG V1.2</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Trial Name / Code:</label>
                <input
                  type="text"
                  value={trialName}
                  onChange={(e) => setTrialName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Target Insect Species:</label>
                <select
                  value={targetSpecies}
                  onChange={(e) => setTargetSpecies(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                >
                  {PEST_CATALOG.map((p) => (
                    <option key={p.id} value={p.scientificName}>
                      {p.scientificName} ({p.commonName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Bioacoustic Stimulus Profile:</label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
                >
                  {ACOUSTIC_PROFILES.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name} ({prof.intensityDbSpl} dB SPL)
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-500 mt-1 italic">
                  Ref: {selectedProfile.literatureRef}
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">
                  Deterministic Test Scenario:
                </label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as DeterministicScenario)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                >
                  <option value="SCENARIO_1_AVOIDANCE">
                    Scenario 1: Deflection after stimulus (Response Observed)
                  </option>
                  <option value="SCENARIO_2_NO_RESPONSE">
                    Scenario 2: Continues towards crop (No Response)
                  </option>
                  <option value="SCENARIO_3_TRACKING_LOST">
                    Scenario 3: Target lost behind obstacle (Inconclusive)
                  </option>
                  <option value="SCENARIO_4_CONTROL_TURNS">
                    Scenario 4: Spontaneous control turning (Natural Baseline)
                  </option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-600 font-semibold mb-1">
                  <span>Minimum Tracking Quality:</span>
                  <span className="font-mono text-emerald-800">{minTrackingQuality}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  value={minTrackingQuality}
                  onChange={(e) => setMinTrackingQuality(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px]">
                  <span className="text-slate-500">Pre-Window:</span>{' '}
                  <strong className="text-slate-800">4.0s</strong>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px]">
                  <span className="text-slate-500">Post-Window:</span>{' '}
                  <strong className="text-slate-800">4.2s</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Trial Result Panel */}
          {trialResult ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs space-y-4 text-xs animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Trial Outcome & Behavioural Metrics
                </h3>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-full uppercase text-[10px] tracking-wide ${
                    trialResult.outcome === 'RESPONSE_OBSERVED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : trialResult.outcome === 'NO_RESPONSE_OBSERVED'
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {trialResult.outcome.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Calculated Metrics Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Trajectory Deflection
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {trialResult.trajectoryDeviationDeg}°
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Time in Crop Zone
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {trialResult.timeInCropZoneSec}s
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Tracking Quality
                  </div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {trialResult.trackingQualityScore}%
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Intervention State
                  </div>
                  <div className="text-xs font-bold text-emerald-700">
                    {trialResult.interventionRequested ? 'REQUESTED (SIM)' : 'NONE (CONTROL)'}
                  </div>
                </div>
              </div>

              {/* Scientific Rationale */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 uppercase text-[10px] block mb-1">
                  Observed Evidence Rationale:
                </span>
                <p className="text-slate-700 leading-relaxed">
                  {trialResult.scientificRationale}
                </p>
              </div>

              {/* Strict Evidence Caveat */}
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 leading-snug">
                <span className="font-bold text-amber-950 uppercase text-[10px] block mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Scientific Limitation & Caveat:</span>
                </span>
                <p className="text-[11px]">{trialResult.evidenceCaveat}</p>
              </div>

              {/* Commit to evidence store button */}
              <button
                onClick={handleSaveToEvidenceStore}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Save Trial to Evidence Explorer</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400 space-y-2">
              <FlaskConical className="w-8 h-8 mx-auto text-slate-300" />
              <div className="text-xs font-semibold text-slate-600">Awaiting Trial Run</div>
              <p className="text-[11px] text-slate-400">
                Click "Run Interactive Trial" to execute the simulation, measure deflection, and evaluate evidence.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
