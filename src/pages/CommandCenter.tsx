import React from 'react';
import {
  Eye,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { KpiCard } from '../components/common/KpiCard';
import { ObservationCanvas } from '../components/observation/ObservationCanvas';
import { TargetInfoCard } from '../components/observation/TargetInfoCard';
import { EventTimeline } from '../components/timeline/EventTimeline';
import { PestSimulationEngine, SimulationState } from '../services/simulationEngine';
import { KpiMetrics } from '../services/storage';
import { SystemStage, ExperimentalCondition } from '../types';

interface CommandCenterProps {
  simulationState: SimulationState;
  simulationEngine: PestSimulationEngine;
  kpis: KpiMetrics;
  onOpenJudgeDemo: () => void;
  onSelectCondition: (cond: ExperimentalCondition) => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  simulationState,
  simulationEngine,
  kpis,
  onOpenJudgeDemo,
  onSelectCondition,
}) => {
  const { target, stage, elapsedMs, isRunning, isPaused, events, trialResult, emitter, cropZone } =
    simulationState;

  // Stages for the progress indicator
  const workflowStages: { key: SystemStage; label: string; desc: string }[] = [
    { key: 'OBSERVE', label: '1. OBSERVE', desc: 'Acquire frame & track candidate target' },
    { key: 'DECIDE', label: '2. DECIDE', desc: 'Evaluate crop zone threat vector' },
    { key: 'INTERVENE', label: '3. INTERVENE', desc: 'Request bioacoustic treatment' },
    { key: 'VERIFY', label: '4. VERIFY', desc: 'Track post-stimulus behaviour' },
  ];

  const getStageStatus = (sKey: SystemStage) => {
    const stageOrder: SystemStage[] = ['IDLE', 'OBSERVE', 'DECIDE', 'INTERVENE', 'VERIFY', 'EVALUATE'];
    const currentIdx = stageOrder.indexOf(stage);
    const itemIdx = stageOrder.indexOf(sKey);

    if (currentIdx > itemIdx || stage === 'EVALUATE') return 'completed';
    if (currentIdx === itemIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                EVIDENCE CONTROL DASHBOARD
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              AI to Bots Control Center
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              "Detect the target. Evaluate the intervention. Verify the response."
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 italic">
              An evidence-aware crop-protection prototype combining computer vision, temporal tracking, intervention control, and behavioural outcome evaluation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenJudgeDemo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>GUIDED JUDGE WALKTHROUGH</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="TARGETS OBSERVED"
          value={kpis.targetsObserved}
          subtitle="Cumulative logged encounters"
          icon={Eye}
          statusVariant="slate"
          badge="DATASET"
          trendText="Multi-frame optical track verified"
        />

        <KpiCard
          label="INTERVENTIONS REQUESTED"
          value={kpis.interventionsRequested}
          subtitle="Gated controller triggers"
          icon={Radio}
          statusVariant="blue"
          badge="SIMULATED"
          trendText="Issued on crop intrusion vector"
        />

        <KpiCard
          label="RESPONSES OBSERVED"
          value={kpis.responsesObserved}
          subtitle="Turn deflection > 120° logged"
          icon={CheckCircle2}
          statusVariant="emerald"
          badge={`${kpis.targetsObserved > 0 ? Math.round((kpis.responsesObserved / kpis.targetsObserved) * 100) : 0}%`}
          trendText="Observed response; not proven yield"
        />

        <KpiCard
          label="INCONCLUSIVE TRIALS"
          value={kpis.inconclusiveTrials}
          subtitle="Occlusion or track loss"
          icon={AlertTriangle}
          statusVariant="amber"
          badge="HONEST"
          trendText="Never classified as deterrence"
        />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Live Observation Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Live Observation Field
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                FOV: 120° GREENHOUSE CANOPY
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
              onStart={() => simulationEngine.startTrial('AI_CONTROLLED', 'SCENARIO_1_AVOIDANCE')}
              onPause={() => simulationEngine.pauseTrial()}
              onResume={() => simulationEngine.resumeTrial()}
              onReset={() => simulationEngine.reset()}
            />

            <TargetInfoCard target={target} elapsedMs={elapsedMs} />
          </div>
        </div>

        {/* Right Panel: Evidence Status & Workflow Progress (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Evidence Status & Stage Pipeline
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sequential closed-loop verification pipeline
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
                ACTIVE
              </span>
            </div>

            {/* 4-Stage Progress Stepper */}
            <div className="space-y-2.5">
              {workflowStages.map((stg) => {
                const status = getStageStatus(stg.key);
                return (
                  <div
                    key={stg.key}
                    className={`p-3 rounded-xl border transition-all ${
                      status === 'active'
                        ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 shadow-xs'
                        : status === 'completed'
                        ? 'bg-slate-50 border-slate-200 text-slate-800'
                        : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            status === 'active'
                              ? 'bg-emerald-700 text-white animate-pulse'
                              : status === 'completed'
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {status === 'completed' ? '✓' : stg.label.split('.')[0]}
                        </span>
                        <span className="font-bold text-xs tracking-wide">
                          {stg.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {status === 'active' ? 'IN PROGRESS' : status === 'completed' ? 'VERIFIED' : 'QUEUED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-8">
                      {stg.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Trial Context & Baseline Status */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">
                  Selected Strategy:
                </span>
                <button
                  onClick={() => onSelectCondition('AI_CONTROLLED')}
                  className="font-mono font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  AI-Controlled Bat FM Pulse Sweep &rarr;
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">
                  Controller Status:
                </span>
                <span className="font-mono font-medium text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Gated Simulated Mode (Safe)
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">
                  Pre-Intervention Baseline:
                </span>
                <span className="font-mono text-slate-800">
                  {target ? `Bearing: 135° | Speed: 41.5 px/s` : 'Awaiting target'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">
                  Post-Intervention Result:
                </span>
                <span className="font-mono text-slate-800">
                  {trialResult ? `Deflection: ${trialResult.trajectoryDeviationDeg}°` : 'Pending evaluation'}
                </span>
              </div>
            </div>

            {/* Final Outcome Classification Card */}
            <div className="rounded-xl border p-4 bg-slate-900 text-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Evidence Classification
                </span>
                {trialResult ? (
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      trialResult.outcome === 'RESPONSE_OBSERVED'
                        ? 'bg-emerald-500 text-white'
                        : trialResult.outcome === 'NO_RESPONSE_OBSERVED'
                        ? 'bg-red-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {trialResult.outcome.replace(/_/g, ' ')}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">
                    AWAITING TRIAL COMPLETION
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {trialResult
                  ? trialResult.scientificRationale
                  : 'Run or start a demonstration encounter to evaluate behavioural response and verify deterrence evidence.'}
              </p>

              {trialResult && (
                <div className="text-[11px] text-amber-300/90 bg-amber-950/50 p-2.5 rounded-lg border border-amber-800/60 leading-snug">
                  <strong>Scientific Notice:</strong> {trialResult.evidenceCaveat}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Event Timeline */}
      <EventTimeline events={events} />
    </div>
  );
};
