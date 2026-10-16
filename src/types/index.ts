export type SystemStage = 'IDLE' | 'OBSERVE' | 'DECIDE' | 'INTERVENE' | 'VERIFY' | 'EVALUATE';

export type ExperimentalCondition = 'SILENT_CONTROL' | 'FIXED_ACOUSTIC' | 'AI_CONTROLLED';

export type DeterministicScenario =
  | 'SCENARIO_1_AVOIDANCE'     // Directional change after intervention -> Response Observed
  | 'SCENARIO_2_NO_RESPONSE'   // Target ignores treatment, continues into crop -> No Response
  | 'SCENARIO_3_TRACKING_LOST' // Target obscured/lost behind foliage -> Inconclusive
  | 'SCENARIO_4_CONTROL_TURNS'; // Target changes direction in silent control -> Baseline variation

export type TrialOutcome = 'RESPONSE_OBSERVED' | 'NO_RESPONSE_OBSERVED' | 'INCONCLUSIVE';

export type TrackingQuality = 'optimal' | 'degraded' | 'lost';

export interface TrajectoryPoint {
  x: number;          // 0 to 100 percentage of canvas
  y: number;          // 0 to 100 percentage of canvas
  t: number;          // elapsed milliseconds from trial start
  inZone: boolean;    // inside configured crop zone
  confidence: number; // 0 to 1
  stage: SystemStage;
}

export interface PestTarget {
  id: string;
  species: string;
  commonName: string;
  scientificName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  confidence: number;
  trackingQuality: TrackingQuality;
  status: 'approaching' | 'in_zone' | 'deterred' | 'unresponsive' | 'lost';
  framesTracked: number;
  trajectory: TrajectoryPoint[];
}

export interface AcousticProfile {
  id: string;
  name: string;
  frequencyRange: string;  // e.g. "28 kHz - 42 kHz Sweep"
  pulsePattern: string;    // e.g. "Bat Echolocation FM Pulse Train"
  intensityDbSpl: number;  // e.g. 102 dB SPL @ 1m
  dutyCycle: string;       // e.g. "120 ms pulse / 80 ms inter-pulse"
  literatureRef: string;   // e.g. "Spangler (1988), Waters (2003) moth tympanal response"
}

export interface TrialRecord {
  id: string;
  trialCode: string;
  timestamp: string;
  condition: ExperimentalCondition;
  scenario: DeterministicScenario;
  targetSpecies: string;
  preInterventionSpeed: number;       // cm/s or px/s
  postInterventionSpeed: number;
  preInterventionBearing: number;     // degrees 0-360
  postInterventionBearing: number;
  trajectoryDeviationDeg: number;     // absolute deflection angle
  timeInCropZoneSec: number;
  trackingQualityScore: number;       // 0 - 100%
  interventionRequested: boolean;
  interventionProfile: string;
  outcome: TrialOutcome;
  scientificRationale: string;
  evidenceCaveat: string;
  trajectory: TrajectoryPoint[];
}

export type HardwareStatusLevel = 'CONNECTED' | 'AVAILABLE' | 'SIMULATED' | 'NOT_CONNECTED' | 'ERROR';

export interface HardwareNode {
  id: string;
  name: string;
  category: 'perception' | 'compute' | 'actuation' | 'storage';
  status: HardwareStatusLevel;
  interfaceType: string;
  latencyMs: number;
  details: string;
  isPhysicalVerified: boolean;
}

export interface EventLogItem {
  id: string;
  timestamp: string;
  elapsedSec: number;
  stage: SystemStage;
  category: 'observation' | 'decision' | 'intervention' | 'outcome' | 'system';
  message: string;
  detail?: string;
}

export interface CropZoneConfig {
  x: number;        // percentage
  y: number;
  radius: number;
  label: string;
}

export interface ArchitectureStage {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
  description: string;
  inputs: string[];
  outputs: string[];
  algorithms: string[];
  failureModes: string[];
  feedbackRole: string;
}
