import { TrialRecord } from '../types';

export function exportTrialsToJson(trials: TrialRecord[], filename = 'ai_to_bots_evidence_trials.json'): void {
  const exportPayload = {
    metadata: {
      system: 'AI TO BOTS — The Proof-of-Deterrence Engine',
      tagline: "Don't just repel pests. Prove what works.",
      exportedAt: new Date().toISOString(),
      recordCount: trials.length,
      dataType: 'DEMONSTRATION_SIMULATION_DATA',
      scientificDisclaimer: 'Demonstration and simulated records. Not validated field trials. Causation requires replicated controlled trials.'
    },
    trials: trials
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTrialsToCsv(trials: TrialRecord[], filename = 'ai_to_bots_evidence_trials.csv'): void {
  const headers = [
    'Trial Code',
    'Timestamp',
    'Condition',
    'Scenario',
    'Target Species',
    'Pre-Intervention Speed (px/s)',
    'Post-Intervention Speed (px/s)',
    'Pre-Intervention Bearing (deg)',
    'Post-Intervention Bearing (deg)',
    'Trajectory Deviation (deg)',
    'Time in Crop Zone (s)',
    'Tracking Quality (%)',
    'Intervention Requested',
    'Intervention Profile',
    'Outcome',
    'Scientific Rationale',
    'Caveat / Evidence Limit'
  ];

  const rows = trials.map(t => [
    `"${t.trialCode}"`,
    `"${t.timestamp}"`,
    `"${t.condition}"`,
    `"${t.scenario}"`,
    `"${t.targetSpecies}"`,
    t.preInterventionSpeed,
    t.postInterventionSpeed,
    t.preInterventionBearing,
    t.postInterventionBearing,
    t.trajectoryDeviationDeg,
    t.timeInCropZoneSec,
    t.trackingQualityScore,
    t.interventionRequested ? 'YES' : 'NO',
    `"${t.interventionProfile.replace(/"/g, '""')}"`,
    `"${t.outcome}"`,
    `"${t.scientificRationale.replace(/"/g, '""')}"`,
    `"${t.evidenceCaveat.replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
