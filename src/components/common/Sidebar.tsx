import React from 'react';
import {
  LayoutDashboard,
  Eye,
  FlaskConical,
  BarChart3,
  Network,
  Settings2,
  CheckCircle2
} from 'lucide-react';

export type PageId =
  | 'command-center'
  | 'live-observation'
  | 'intervention-lab'
  | 'evidence-explorer'
  | 'system-architecture'
  | 'hardware-settings';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  trialsCount: number;
}

interface NavItem {
  id: PageId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage, trialsCount }) => {
  const navItems: NavItem[] = [
    {
      id: 'command-center',
      label: 'Command Center',
      subtitle: 'Real-time overview & KPIs',
      icon: LayoutDashboard,
    },
    {
      id: 'live-observation',
      label: 'Live Observation',
      subtitle: 'Perception & tracking HUD',
      icon: Eye,
      badge: 'LIVE',
    },
    {
      id: 'intervention-lab',
      label: 'Intervention Lab',
      subtitle: 'Controlled trial experiments',
      icon: FlaskConical,
      badge: 'CORE',
    },
    {
      id: 'evidence-explorer',
      label: 'Evidence Explorer',
      subtitle: 'Comparative analytics & export',
      icon: BarChart3,
      badge: `${trialsCount}`,
    },
    {
      id: 'system-architecture',
      label: 'System Architecture',
      subtitle: '6-stage closed loop flow',
      icon: Network,
    },
    {
      id: 'hardware-settings',
      label: 'Hardware & Settings',
      subtitle: 'Transducers & parameters',
      icon: Settings2,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Top identity banner */}
      <div className="p-5 border-b border-slate-800">
        <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 mb-1">
          Bioacoustic Verification System
        </div>
        <div className="text-base font-bold text-white tracking-tight">
          AI TO BOTS
        </div>
        <div className="text-xs text-slate-400 italic mt-0.5">
          "Don't just repel pests. Prove what works."
        </div>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Navigation Modules
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all ${
                isActive
                  ? 'bg-emerald-800/90 text-white font-medium shadow-sm border border-emerald-700/60'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-emerald-300' : 'text-slate-400'
                  }`}
                />
                <div className="truncate">
                  <div className="text-sm font-medium leading-tight truncate">
                    {item.label}
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      isActive ? 'text-emerald-200' : 'text-slate-500'
                    }`}
                  >
                    {item.subtitle}
                  </div>
                </div>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase shrink-0 ml-1 ${
                    isActive
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar footer with Scientific Principle card */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60">
        <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Scientific Tenet</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Activation does not equal deterrence. Behavioural response must be measured against control baselines.
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Simulation Mode</span>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
      </div>
    </aside>
  );
};
