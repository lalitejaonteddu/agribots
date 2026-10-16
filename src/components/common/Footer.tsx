import React from 'react';
import { AlertCircle, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 py-3 px-6 text-xs text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-slate-700">AI TO BOTS</span>
        <span className="text-slate-300">|</span>
        <span>The Proof-of-Deterrence Engine</span>
        <span className="hidden sm:inline text-slate-300">|</span>
        <span className="hidden sm:inline text-slate-400">
          "Don't just repel pests. Prove what works."
        </span>
      </div>

      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          <span>Demonstration Environment &middot; Synthetic Data & Gated Controller</span>
        </div>
        <div className="hidden lg:flex items-center gap-1 text-slate-400">
          <Cpu className="w-3 h-3" />
          <span>v1.0.4-hackathon</span>
        </div>
      </div>
    </footer>
  );
};
