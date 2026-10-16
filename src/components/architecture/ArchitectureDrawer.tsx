import React from 'react';
import { X, CheckCircle, AlertTriangle, Cpu, Layers } from 'lucide-react';
import { ArchitectureStage } from '../../types';

interface ArchitectureDrawerProps {
  stage: ArchitectureStage | null;
  onClose: () => void;
}

export const ArchitectureDrawer: React.FC<ArchitectureDrawerProps> = ({ stage, onClose }) => {
  if (!stage) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-700">
                STAGE {stage.stepNumber} ARCHITECTURE
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white mt-1.5">
              {stage.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{stage.subtitle}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Function Description */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <span>Core Functional Purpose</span>
            </h4>
            <p className="text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              {stage.description}
            </p>
          </div>

          {/* Inputs & Outputs Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Inputs */}
            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
              <div className="font-bold text-blue-900 text-[11px] uppercase tracking-wider mb-2">
                Inputs Received
              </div>
              <ul className="space-y-1.5 text-slate-700">
                {stage.inputs.map((inp, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-blue-500 font-bold">•</span>
                    <span>{inp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Outputs */}
            <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-100">
              <div className="font-bold text-purple-900 text-[11px] uppercase tracking-wider mb-2">
                Outputs Emitted
              </div>
              <ul className="space-y-1.5 text-slate-700">
                {stage.outputs.map((out, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-purple-500 font-bold">•</span>
                    <span>{out}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Algorithmic Processing & Math */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Algorithmic Processing & Rules</span>
            </h4>
            <div className="space-y-2">
              {stage.algorithms.map((algo, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 font-mono text-[11px] text-slate-800"
                >
                  {algo}
                </div>
              ))}
            </div>
          </div>

          {/* Failure Modes & Safeguards */}
          <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200">
            <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Failure Modes & Safeguards</span>
            </h4>
            <ul className="space-y-1.5 text-amber-900">
              {stage.failureModes.map((fm, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-amber-500 font-bold">⚠</span>
                  <span>{fm}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Closed Loop Feedback Role */}
          <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
            <h4 className="font-bold text-emerald-950 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Closed-Loop Feedback Role</span>
            </h4>
            <p className="text-emerald-900 leading-relaxed">{stage.feedbackRole}</p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Close Stage Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
