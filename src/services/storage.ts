import { TrialRecord, ExperimentalCondition } from '../types';
import { INITIAL_TRIALS } from '../data/initialTrials';

const STORAGE_KEY = 'ai_to_bots_evidence_trials_v1';

export function getStoredTrials(): TrialRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TRIALS));
      return INITIAL_TRIALS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_TRIALS;
  } catch (e) {
    console.warn('Failed to read from localStorage, using initial trials', e);
    return INITIAL_TRIALS;
  }
}

export function saveTrial(trial: TrialRecord): void {
  try {
    const current = getStoredTrials();
    const updated = [trial, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save trial to localStorage', e);
  }
}

export function resetStoredTrials(): TrialRecord[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TRIALS));
  } catch (e) {
    console.error('Failed to reset localStorage', e);
  }
  return INITIAL_TRIALS;
}

export interface KpiMetrics {
  targetsObserved: number;
  interventionsRequested: number;
  responsesObserved: number;
  inconclusiveTrials: number;
  noResponseTrials: number;
  avgTrackingQuality: number;
}

export function calculateKpis(trials: TrialRecord[]): KpiMetrics {
  const targetsObserved = trials.length;
  const interventionsRequested = trials.filter(t => t.interventionRequested).length;
  const responsesObserved = trials.filter(t => t.outcome === 'RESPONSE_OBSERVED').length;
  const inconclusiveTrials = trials.filter(t => t.outcome === 'INCONCLUSIVE').length;
  const noResponseTrials = trials.filter(t => t.outcome === 'NO_RESPONSE_OBSERVED').length;
  
  const avgTrackingQuality = trials.length > 0
    ? Math.round(trials.reduce((acc, t) => acc + (t.trackingQualityScore || 90), 0) / trials.length)
    : 0;

  return {
    targetsObserved,
    interventionsRequested,
    responsesObserved,
    inconclusiveTrials,
    noResponseTrials,
    avgTrackingQuality
  };
}

export interface ConditionSummary {
  condition: ExperimentalCondition;
  totalTrials: number;
  completed: number;
  interventionsRequested: number;
  responsesObserved: number;
  responseRatePct: number;
  noResponse: number;
  inconclusive: number;
  avgDeflectionDeg: number;
  avgTimeInZoneSec: number;
}

export function summarizeByCondition(trials: TrialRecord[]): Record<ExperimentalCondition, ConditionSummary> {
  const conditions: ExperimentalCondition[] = ['SILENT_CONTROL', 'FIXED_ACOUSTIC', 'AI_CONTROLLED'];
  const summary: Record<ExperimentalCondition, ConditionSummary> = {
    SILENT_CONTROL: {
      condition: 'SILENT_CONTROL',
      totalTrials: 0,
      completed: 0,
      interventionsRequested: 0,
      responsesObserved: 0,
      responseRatePct: 0,
      noResponse: 0,
      inconclusive: 0,
      avgDeflectionDeg: 0,
      avgTimeInZoneSec: 0
    },
    FIXED_ACOUSTIC: {
      condition: 'FIXED_ACOUSTIC',
      totalTrials: 0,
      completed: 0,
      interventionsRequested: 0,
      responsesObserved: 0,
      responseRatePct: 0,
      noResponse: 0,
      inconclusive: 0,
      avgDeflectionDeg: 0,
      avgTimeInZoneSec: 0
    },
    AI_CONTROLLED: {
      condition: 'AI_CONTROLLED',
      totalTrials: 0,
      completed: 0,
      interventionsRequested: 0,
      responsesObserved: 0,
      responseRatePct: 0,
      noResponse: 0,
      inconclusive: 0,
      avgDeflectionDeg: 0,
      avgTimeInZoneSec: 0
    }
  };

  conditions.forEach(cond => {
    const list = trials.filter(t => t.condition === cond);
    const total = list.length;
    const req = list.filter(t => t.interventionRequested).length;
    const resp = list.filter(t => t.outcome === 'RESPONSE_OBSERVED').length;
    const noResp = list.filter(t => t.outcome === 'NO_RESPONSE_OBSERVED').length;
    const inconc = list.filter(t => t.outcome === 'INCONCLUSIVE').length;
    const avgDef = total > 0 ? Math.round(list.reduce((acc, t) => acc + t.trajectoryDeviationDeg, 0) / total) : 0;
    const avgTime = total > 0 ? +(list.reduce((acc, t) => acc + t.timeInCropZoneSec, 0) / total).toFixed(1) : 0;
    const rate = total > 0 ? Math.round((resp / total) * 100) : 0;

    summary[cond] = {
      condition: cond,
      totalTrials: total,
      completed: total,
      interventionsRequested: req,
      responsesObserved: resp,
      responseRatePct: rate,
      noResponse: noResp,
      inconclusive: inconc,
      avgDeflectionDeg: avgDef,
      avgTimeInZoneSec: avgTime
    };
  });

  return summary;
}
