import React from 'react';
import { ShieldCheck, Sparkles, RefreshCw, Cpu, Activity, Radio } from 'lucide-react';

interface HeaderProps {
  onStartJudgeDemo: () => void;
  onResetData: () => void;
  systemStage: string;
  isSimulating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onStartJudgeDemo,
  onResetData,
  systemStage,
  isSimulating,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-900 flex items-center justify-center text-emerald-400 shadow-sm border border-emerald-800">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">
                AI TO BOTS
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                PROTOTYPE v1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              The Proof-of-Deterrence Engine &middot; Evidence-Aware Bioacoustic Crop Protection
            </p>
          </div>
        </div>

        {/* Global status indicators & Judge Demo trigger */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Demo Simulation Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`}></span>
            <span>{isSimulating ? 'SIMULATION RUNNING' : 'DEMO SIMULATION'}</span>
          </div>

          {/* Perception Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-slate-500">PERCEPTION:</span>
            <span className="text-emerald-700 font-medium">SYNTHETIC 30 FPS</span>
          </div>

          {/* Controller Status */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-slate-500">CONTROLLER:</span>
            <span className="text-blue-700 font-medium">GATED (SAFE)</span>
          </div>

          {/* Stage indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            <Cpu className="w-3.5 h-3.5 text-emerald-700" />
            <span className="font-semibold text-emerald-600">STAGE:</span>
            <span className="font-bold tracking-wide">{systemStage}</span>
          </div>

          {/* Reset Demo Data Button */}
          <button
            onClick={onResetData}
            title="Reset demonstration trial records"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* START JUDGE DEMO BUTTON */}
          <button
            onClick={onStartJudgeDemo}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-sm transition-all hover:shadow hover:scale-[1.01] active:scale-[0.99] border border-emerald-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>START JUDGE DEMO</span>
          </button>
        </div>
      </div>
    </header>
  );
};
