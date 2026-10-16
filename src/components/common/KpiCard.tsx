import React from 'react';
import { LucideIcon, Info } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  badge?: string;
  statusVariant?: 'emerald' | 'amber' | 'blue' | 'slate' | 'red';
  trendText?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  badge,
  statusVariant = 'emerald',
  trendText,
}) => {
  const variantStyles = {
    emerald: {
      bg: 'bg-emerald-50/70 border-emerald-200/80',
      iconBg: 'bg-emerald-100 text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      value: 'text-emerald-950',
    },
    amber: {
      bg: 'bg-amber-50/70 border-amber-200/80',
      iconBg: 'bg-amber-100 text-amber-800',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      value: 'text-amber-950',
    },
    blue: {
      bg: 'bg-blue-50/70 border-blue-200/80',
      iconBg: 'bg-blue-100 text-blue-800',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      value: 'text-blue-950',
    },
    red: {
      bg: 'bg-red-50/70 border-red-200/80',
      iconBg: 'bg-red-100 text-red-800',
      badge: 'bg-red-100 text-red-800 border-red-300',
      value: 'text-red-950',
    },
    slate: {
      bg: 'bg-slate-50/70 border-slate-200/80',
      iconBg: 'bg-slate-100 text-slate-800',
      badge: 'bg-slate-100 text-slate-800 border-slate-300',
      value: 'text-slate-900',
    },
  };

  const v = variantStyles[statusVariant];

  return (
    <div
      className={`rounded-xl border p-4 bg-white shadow-2xs hover:shadow-xs transition-all relative overflow-hidden`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {label}
            </span>
            <span
              title="Demonstration dataset figure"
              className="text-[10px] text-slate-400 cursor-help"
            >
              [DEMO]
            </span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>

        <div className={`p-2.5 rounded-xl ${v.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="truncate pr-2">{subtitle}</span>
        {badge && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border shrink-0 ${v.badge}`}
          >
            {badge}
          </span>
        )}
      </div>

      {trendText && (
        <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>{trendText}</span>
        </div>
      )}
    </div>
  );
};
