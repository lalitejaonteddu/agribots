import React from 'react';
import { Target, Compass, Gauge, Clock, Layers } from 'lucide-react';
import { PestTarget } from '../../types';

interface TargetInfoCardProps {
  target: PestTarget | null;
  elapsedMs: number;
}

export const TargetInfoCard: React.FC<TargetInfoCardProps> = ({ target, elapsedMs }) => {
  if (!target) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs text-center flex flex-col items-center justify-center min-h-[260px]">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
          <Target className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-700">No Target in Perception Field</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Target telemetry will populate in real time once candidate moth target is acquired by the observation stream.
        </p>
      </div>
    );
  }

  const speed = Math.hypot(target.vx, target.vy) * 6; // scaled for readability
  const angleRad = Math.atan2(target.vy, target.vx);
  const angleDeg = Math.round(((angleRad * 180) / Math.PI + 360) % 360);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
      {/* Target Identity Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {target.id}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                target.trackingQuality === 'optimal'
                  ? 'bg-emerald-100 text-emerald-800'
                  : target.trackingQuality === 'degraded'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              TRACK: {target.trackingQuality}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900 mt-1.5 italic">
            {target.species}
          </div>
          <div className="text-xs text-slate-500">{target.commonName}</div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase font-semibold text-slate-400">
            CONFIDENCE
          </div>
          <div className="text-lg font-bold font-mono text-slate-800">
            {(target.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Grid of Key Telemetry Metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span>BEARING</span>
          </div>
          <div className="font-mono font-bold text-slate-800 text-sm">
            {angleDeg}° N-VEC
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
            <Gauge className="w-3.5 h-3.5 text-purple-600" />
            <span>EST. VELOCITY</span>
          </div>
          <div className="font-mono font-bold text-slate-800 text-sm">
            {speed.toFixed(1)} px/s
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>TRACK DURATION</span>
          </div>
          <div className="font-mono font-bold text-slate-800 text-sm">
            {(elapsedMs / 1000).toFixed(1)}s
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>FRAMES TRACKED</span>
          </div>
          <div className="font-mono font-bold text-slate-800 text-sm">
            {target.framesTracked} frames
          </div>
        </div>
      </div>

      {/* Coordinates */}
      <div className="bg-slate-50/70 p-2 rounded-lg border border-slate-200/60 flex items-center justify-between text-[11px] font-mono text-slate-600">
        <span>COORDINATES:</span>
        <span className="font-semibold text-slate-800">
          X: {target.x.toFixed(1)}% | Y: {target.y.toFixed(1)}%
        </span>
      </div>

      {/* Scientific disclaimer notice */}
      <div className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded border border-slate-100 italic leading-snug">
        Notice: Simulated confidence value is illustrative and is not the output of an attached trained neural network model.
      </div>
    </div>
  );
};
