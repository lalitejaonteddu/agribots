import {
  SystemStage,
  ExperimentalCondition,
  DeterministicScenario,
  TrialOutcome,
  PestTarget,
  TrialRecord,
  EventLogItem
} from '../types';

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  elapsedMs: number;
  stage: SystemStage;
  target: PestTarget | null;
  cropZone: { x: number; y: number; radius: number };
  emitter: { x: number; y: number; isActive: boolean; pulseCount: number };
  condition: ExperimentalCondition;
  scenario: DeterministicScenario;
  trialCode: string;
  events: EventLogItem[];
  trialResult: TrialRecord | null;
}

export interface SimulationCallbacks {
  onUpdate: (state: SimulationState) => void;
  onEvent: (event: EventLogItem) => void;
  onComplete: (trial: TrialRecord) => void;
}

export class PestSimulationEngine {
  private state: SimulationState;
  private callbacks: SimulationCallbacks;
  private intervalId: number | null = null;
  private startTime: number = 0;
  private lastTickTime: number = 0;

  constructor(callbacks: SimulationCallbacks) {
    this.callbacks = callbacks;
    this.state = this.getInitialState();
  }

  public getInitialState(): SimulationState {
    return {
      isRunning: false,
      isPaused: false,
      elapsedMs: 0,
      stage: 'IDLE',
      target: null,
      cropZone: { x: 55, y: 55, radius: 26 },
      emitter: { x: 50, y: 35, isActive: false, pulseCount: 0 },
      condition: 'AI_CONTROLLED',
      scenario: 'SCENARIO_1_AVOIDANCE',
      trialCode: `TR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      events: [],
      trialResult: null
    };
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  public startTrial(
    condition: ExperimentalCondition = 'AI_CONTROLLED',
    scenario: DeterministicScenario = 'SCENARIO_1_AVOIDANCE',
    speciesName: string = 'Helicoverpa armigera',
    trialName?: string
  ): void {
    this.stopTrial();

    const trialCode = trialName || `TR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const initialTarget: PestTarget = {
      id: `TGT-${Math.floor(100 + Math.random() * 900)}`,
      species: speciesName,
      commonName: speciesName.includes('armigera') ? 'Cotton Bollworm' : speciesName.includes('frugiperda') ? 'Fall Armyworm' : 'Diamondback Moth',
      scientificName: speciesName,
      x: 12,
      y: 18,
      vx: 6.5,
      vy: 5.5,
      width: 28,
      height: 22,
      confidence: 0.94,
      trackingQuality: 'optimal',
      status: 'approaching',
      framesTracked: 1,
      trajectory: [{ x: 12, y: 18, t: 0, inZone: false, confidence: 0.94, stage: 'OBSERVE' }]
    };

    const initialEvent: EventLogItem = {
      id: `evt-${Date.now()}-1`,
      timestamp: new Date().toLocaleTimeString(),
      elapsedSec: 0,
      stage: 'OBSERVE',
      category: 'system',
      message: `Observation session started [${condition}] — ${scenario.replace('SCENARIO_', '').replace(/_/g, ' ')}`,
      detail: 'Perception pipeline active. Synthetic video feed initialized at 30 fps.'
    };

    this.state = {
      ...this.getInitialState(),
      isRunning: true,
      stage: 'OBSERVE',
      condition,
      scenario,
      trialCode,
      target: initialTarget,
      events: [initialEvent]
    };

    this.startTime = performance.now();
    this.lastTickTime = this.startTime;

    this.callbacks.onEvent(initialEvent);
    this.callbacks.onUpdate(this.state);

    this.intervalId = window.setInterval(() => this.tick(), 40);
  }

  public pauseTrial(): void {
    if (this.state.isRunning && !this.state.isPaused) {
      this.state.isPaused = true;
      const pauseEvent: EventLogItem = {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        elapsedSec: +(this.state.elapsedMs / 1000).toFixed(1),
        stage: this.state.stage,
        category: 'system',
        message: 'Observation paused by operator'
      };
      this.state.events.unshift(pauseEvent);
      this.callbacks.onEvent(pauseEvent);
      this.callbacks.onUpdate(this.state);
    }
  }

  public resumeTrial(): void {
    if (this.state.isRunning && this.state.isPaused) {
      this.state.isPaused = false;
      this.lastTickTime = performance.now();
      const resumeEvent: EventLogItem = {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        elapsedSec: +(this.state.elapsedMs / 1000).toFixed(1),
        stage: this.state.stage,
        category: 'system',
        message: 'Observation resumed'
      };
      this.state.events.unshift(resumeEvent);
      this.callbacks.onEvent(resumeEvent);
      this.callbacks.onUpdate(this.state);
    }
  }

  public stopTrial(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.callbacks.onUpdate(this.state);
  }

  public reset(): void {
    this.stopTrial();
    this.state = this.getInitialState();
    this.callbacks.onUpdate(this.state);
  }

  private tick(): void {
    if (!this.state.isRunning || this.state.isPaused || !this.state.target) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
    this.lastTickTime = now;
    this.state.elapsedMs += dt * 1000;

    const elapsedSec = this.state.elapsedMs / 1000;
    const tgt = this.state.target;
    tgt.framesTracked += 1;

    // STAGES PROGRESSION
    // 0.0s - 2.5s : OBSERVE
    // 2.5s - 4.2s : DECIDE
    // 4.2s - 5.8s : INTERVENE (if condition demands)
    // 5.8s - 8.2s : VERIFY
    // 8.2s+       : EVALUATE & COMPLETE

    if (elapsedSec < 2.5) {
      if (this.state.stage !== 'OBSERVE') {
        this.transitionStage('OBSERVE', 'Initial target track established. Optical flow & vector computed.');
      }
      // Target moves towards crop center
      tgt.x += tgt.vx * dt * 2.2;
      tgt.y += tgt.vy * dt * 2.2;
      tgt.confidence = Math.min(0.98, 0.90 + Math.random() * 0.06);
    } else if (elapsedSec < 4.2) {
      if (this.state.stage !== 'DECIDE') {
        let decideMsg = 'Decision engine evaluating target vector against crop zone threshold.';
        if (this.state.condition === 'SILENT_CONTROL') {
          decideMsg = 'Silent Control: Intervention withheld to establish biological baseline.';
        } else if (this.state.condition === 'FIXED_ACOUSTIC') {
          decideMsg = 'Fixed Treatment: Pre-scheduled intervention trigger queued.';
        } else {
          decideMsg = 'AI-Controlled: Target heading intersects crop zone (p=0.96). Trigger criteria satisfied.';
        }
        this.transitionStage('DECIDE', decideMsg);
      }
      tgt.x += tgt.vx * dt * 2.0;
      tgt.y += tgt.vy * dt * 2.0;
    } else if (elapsedSec < 5.8) {
      if (this.state.stage !== 'INTERVENE') {
        if (this.state.condition === 'SILENT_CONTROL') {
          this.transitionStage('INTERVENE', 'No intervention requested (Control group). Passive tracking continues.');
        } else {
          this.state.emitter.isActive = true;
          this.state.emitter.pulseCount += 1;
          this.transitionStage(
            'INTERVENE',
            'SIMULATED bioacoustic intervention command issued to controller (Bat FM Sweep 28-44kHz, 104 dB SPL).'
          );
        }
      }

      // Movement based on scenario
      this.updateTargetTrajectory(dt, elapsedSec);
    } else if (elapsedSec < 8.2) {
      if (this.state.stage !== 'VERIFY') {
        this.state.emitter.isActive = false;
        this.transitionStage('VERIFY', 'Post-intervention observation window active. Measuring behavioural deflection.');
      }
      this.updateTargetTrajectory(dt, elapsedSec);
    } else {
      // Completed!
      this.completeTrial();
    }

    // Check if target is inside crop zone
    const distToZoneCenter = Math.hypot(tgt.x - this.state.cropZone.x, tgt.y - this.state.cropZone.y);
    const inZone = distToZoneCenter <= this.state.cropZone.radius;

    // Record trajectory point every 120ms or major state change
    const lastPt = tgt.trajectory[tgt.trajectory.length - 1];
    if (!lastPt || (this.state.elapsedMs - lastPt.t) > 120) {
      tgt.trajectory.push({
        x: +tgt.x.toFixed(2),
        y: +tgt.y.toFixed(2),
        t: Math.round(this.state.elapsedMs),
        inZone,
        confidence: +tgt.confidence.toFixed(2),
        stage: this.state.stage
      });
    }

    this.callbacks.onUpdate(this.state);
  }

  private updateTargetTrajectory(dt: number, elapsedSec: number): void {
    const tgt = this.state.target!;
    const scenario = this.state.scenario;

    if (scenario === 'SCENARIO_1_AVOIDANCE') {
      // Avoidance: sudden turning after 4.5s
      if (elapsedSec > 4.5) {
        tgt.vx = -7.5;
        tgt.vy = -6.0;
        tgt.status = 'deterred';
      }
      tgt.x += tgt.vx * dt * 2.4;
      tgt.y += tgt.vy * dt * 2.4;
      tgt.trackingQuality = 'optimal';
      tgt.confidence = 0.95;
    } else if (scenario === 'SCENARIO_2_NO_RESPONSE') {
      // Continues directly into crop zone
      tgt.status = 'unresponsive';
      tgt.x += tgt.vx * dt * 1.8;
      tgt.y += tgt.vy * dt * 1.8;
      tgt.trackingQuality = 'optimal';
      tgt.confidence = 0.96;
    } else if (scenario === 'SCENARIO_3_TRACKING_LOST') {
      // Target disappears behind occlusion around 4.8s
      if (elapsedSec > 4.6) {
        tgt.trackingQuality = 'lost';
        tgt.status = 'lost';
        tgt.confidence = Math.max(0, tgt.confidence - dt * 1.5);
      } else {
        tgt.x += tgt.vx * dt * 1.8;
        tgt.y += tgt.vy * dt * 1.8;
      }
    } else if (scenario === 'SCENARIO_4_CONTROL_TURNS') {
      // Spontaneous natural turn in control condition
      if (elapsedSec > 4.4) {
        tgt.vx = -4.5;
        tgt.vy = 6.2;
      }
      tgt.x += tgt.vx * dt * 2.0;
      tgt.y += tgt.vy * dt * 2.0;
      tgt.trackingQuality = 'optimal';
      tgt.confidence = 0.93;
    }
  }

  private transitionStage(newStage: SystemStage, logMessage: string): void {
    this.state.stage = newStage;
    const catMap: Record<SystemStage, EventLogItem['category']> = {
      IDLE: 'system',
      OBSERVE: 'observation',
      DECIDE: 'decision',
      INTERVENE: 'intervention',
      VERIFY: 'observation',
      EVALUATE: 'outcome'
    };

    const evt: EventLogItem = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString(),
      elapsedSec: +(this.state.elapsedMs / 1000).toFixed(1),
      stage: newStage,
      category: catMap[newStage],
      message: logMessage
    };

    this.state.events.unshift(evt);
    this.callbacks.onEvent(evt);
  }

  private completeTrial(): void {
    this.stopTrial();
    this.state.stage = 'EVALUATE';

    const tgt = this.state.target!;
    const scenario = this.state.scenario;
    const condition = this.state.condition;

    let outcome: TrialOutcome = 'NO_RESPONSE_OBSERVED';
    let rationale = '';
    let caveat = '';
    let deviationDeg = 8;
    let timeInZone = 4.5;
    let trackingScore = 95;
    let postSpeed = 38.0;
    const preSpeed = 41.5;

    if (scenario === 'SCENARIO_1_AVOIDANCE') {
      outcome = 'RESPONSE_OBSERVED';
      deviationDeg = 158;
      timeInZone = 0.3;
      trackingScore = 97;
      postSpeed = 61.2;
      rationale = 'Angular trajectory deflection >120° observed within 420 ms of bioacoustic stimulus request.';
      caveat = 'Response observed in single encounter. Replicated control-comparison required to confirm causation.';
    } else if (scenario === 'SCENARIO_2_NO_RESPONSE') {
      outcome = 'NO_RESPONSE_OBSERVED';
      deviationDeg = 6;
      timeInZone = 5.4;
      trackingScore = 96;
      postSpeed = 39.0;
      rationale = 'Target maintained direct vector into crop canopy (<15° deflection). No observable avoidance reflex.';
      caveat = 'Intervention parameters produced no demonstrable flight modification in this trial.';
    } else if (scenario === 'SCENARIO_3_TRACKING_LOST') {
      outcome = 'INCONCLUSIVE';
      deviationDeg = 0;
      timeInZone = 1.0;
      trackingScore = 44;
      postSpeed = 0;
      rationale = 'Optical tracking lost behind obstacle during post-intervention window. Track quality dropped to 44%.';
      caveat = 'Target non-visibility must NOT be counted as successful deterrence. Scientifically classified as inconclusive.';
    } else if (scenario === 'SCENARIO_4_CONTROL_TURNS') {
      outcome = 'RESPONSE_OBSERVED';
      deviationDeg = 92;
      timeInZone = 0.7;
      trackingScore = 93;
      postSpeed = 45.0;
      rationale = 'Natural flight deflection occurred without acoustic intervention (Baseline Control variation).';
      caveat = 'CRITICAL BASELINE EVIDENCE: Demonstrates that pests turn spontaneously, proving why treatment alone cannot be assumed causal.';
    }

    const trialRecord: TrialRecord = {
      id: `trial_${Date.now()}`,
      trialCode: this.state.trialCode,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      condition,
      scenario,
      targetSpecies: tgt.species,
      preInterventionSpeed: preSpeed,
      postInterventionSpeed: postSpeed,
      preInterventionBearing: 135,
      postInterventionBearing: (135 + deviationDeg) % 360,
      trajectoryDeviationDeg: deviationDeg,
      timeInCropZoneSec: timeInZone,
      trackingQualityScore: trackingScore,
      interventionRequested: condition !== 'SILENT_CONTROL',
      interventionProfile: condition === 'SILENT_CONTROL' ? 'None (Silent Control)' : 'Bat Echolocation FM Sweep (28–44 kHz)',
      outcome,
      scientificRationale: rationale,
      evidenceCaveat: caveat,
      trajectory: [...tgt.trajectory]
    };

    this.state.trialResult = trialRecord;

    const completionEvt: EventLogItem = {
      id: `evt-${Date.now()}-done`,
      timestamp: new Date().toLocaleTimeString(),
      elapsedSec: +(this.state.elapsedMs / 1000).toFixed(1),
      stage: 'EVALUATE',
      category: 'outcome',
      message: `Trial evaluation finalized: ${outcome.replace(/_/g, ' ')}`,
      detail: rationale
    };

    this.state.events.unshift(completionEvt);
    this.callbacks.onEvent(completionEvt);
    this.callbacks.onComplete(trialRecord);
    this.callbacks.onUpdate(this.state);
  }
}
