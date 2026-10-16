import React, { useState } from 'react';
import {
  Clock,
  Eye,
  Brain,
  Volume2,
  CheckCircle,
  Terminal
} from 'lucide-react';
import { EventLogItem } from '../../types';

interface EventTimelineProps {
  events: EventLogItem[];
  maxItems?: number;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events, maxItems = 15 }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filtered = events.filter((evt) => {
    if (filterCategory === 'all') return true;
    return evt.category === filterCategory;
  });

  const displayList = filtered.slice(0, maxItems);

  const getCategoryBadge = (category: EventLogItem['category']) => {
    switch (category) {
      case 'observation':
        return {
          icon: Eye,
          label: 'OBSERVE',
          style: 'bg-blue-50 text-blue-700 border-blue-200'
        };
      case 'decision':
        return {
          icon: Brain,
          label: 'DECIDE',
          style: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      case 'intervention':
        return {
          icon: Volume2,
          label: 'INTERVENE',
          style: 'bg-purple-50 text-purple-700 border-purple-200'
        };
      case 'outcome':
        return {
          icon: CheckCircle,
          label: 'OUTCOME',
          style: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      default:
        return {
          icon: Terminal,
          label: 'SYSTEM',
          style: 'bg-slate-50 text-slate-700 border-slate-200'
        };
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
      {/* Timeline Header & Filter */}
      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Event Timeline (Actual Elapsed Time)
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">
            [{events.length} events logged]
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-slate-400 mr-1 hidden sm:inline">Filter:</span>
          {['all', 'observation', 'decision', 'intervention', 'outcome'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2 py-0.5 rounded-md font-medium capitalize transition-colors cursor-pointer ${
                filterCategory === cat
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
        {displayList.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No events recorded in this filter view.
          </div>
        ) : (
          displayList.map((evt) => {
            const badge = getCategoryBadge(evt.category);
            const Icon = badge.icon;

            return (
              <div
                key={evt.id}
                className="px-4 py-2.5 hover:bg-slate-50/60 transition-colors flex items-start gap-3 text-xs"
              >
                {/* Elapsed Time timestamp */}
                <div className="shrink-0 font-mono text-[11px] text-slate-400 pt-0.5 w-16">
                  +{evt.elapsedSec.toFixed(1)}s
                </div>

                {/* Category Badge */}
                <span
                  className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${badge.style}`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{badge.label}</span>
                </span>

                {/* Message & detail */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 leading-tight">
                    {evt.message}
                  </div>
                  {evt.detail && (
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {evt.detail}
                    </div>
                  )}
                </div>

                {/* Real clock time */}
                <div className="shrink-0 text-[10px] text-slate-400 font-mono hidden md:block">
                  {evt.timestamp}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
