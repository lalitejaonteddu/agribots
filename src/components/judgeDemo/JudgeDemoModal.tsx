import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CheckCircle,
  Eye,
  Brain,
  Volume2,
  LineChart,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  Play
} from 'lucide-react';
import { PageId } from '../common/Sidebar';

interface JudgeDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPage: (page: PageId) => void;
  onTriggerSimulation: (scenario: 'SCENARIO_1_AVOIDANCE' | 'SCENARIO_2_NO_RESPONSE' | 'SCENARIO_3_TRACKING_LOST') => void;
}

interface DemoStep {
  stepNumber: number;
  stageName: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  explanation: string;
  judgeKeyTakeaway: string;
  suggestedAction: string;
  scenarioPreset?: 'SCENARIO_1_AVOIDANCE' | 'SCENARIO_2_NO_RESPONSE' | 'SCENARIO_3_TRACKING_LOST';
  targetPage: PageId;
}

export const JudgeDemoModal: React.FC<JudgeDemoModalProps> = ({
  isOpen,
  onClose,
  onNavigateToPage,
  onTriggerSimulation,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const demoSteps: DemoStep[] = [
    {
      stepNumber: 1,
      stageName: 'OBSERVE',
      title: 'Stage 1: Detect & Establish Trajectory',
      subtitle: 'Visual observation & candidate identification',
      icon: Eye,
      explanation:
        'A candidate insect pest (e.g. Helicoverpa armigera) enters the greenhouse bay. Rather than acting on a single instant frame, the system establishes a multi-frame temporal track with velocity vectors and confidence metrics.',
      judgeKeyTakeaway:
        'Detection confidence (96%) measures visual match certainty, NOT biological deterrence certainty.',
      suggestedAction: 'Observe the moth entering from the top-left with a blue bounding reticle and motion vector.',
      scenarioPreset: 'SCENARIO_1_AVOIDANCE',
      targetPage: 'command-center',
    },
    {
      stepNumber: 2,
      stageName: 'DECIDE',
      title: 'Stage 2: Evaluate Intervention Criteria',
      subtitle: 'Evidence-gated spatial intrusion rules',
      icon: Brain,
      explanation:
        'The decision engine projects the flight heading against the configured Crop Protection Zone. An intervention is only requested if the insect is on an intercept vector with sustained confidence >85%, avoiding wasteful emissions.',
      judgeKeyTakeaway:
        'Bioacoustic activation is gated and context-aware, not continuous or spray-and-pray.',
      suggestedAction: 'Watch the system stage transition from OBSERVE to DECIDE with vector calculation in event log.',
      scenarioPreset: 'SCENARIO_1_AVOIDANCE',
      targetPage: 'command-center',
    },
    {
      stepNumber: 3,
      stageName: 'INTERVENE',
      title: 'Stage 3: Controlled Intervention Request',
      subtitle: 'Literature-informed ultrasound stimulus request',
      icon: Volume2,
      explanation:
        'The system requests a simulated 28–44 kHz FM ultrasonic bat-echolocation pulse train (104 dB SPL). The UI displays radiating acoustic wave pulses from the transducer beacon. The hardware state is explicitly labelled as SIMULATED.',
      judgeKeyTakeaway:
        'An intervention request is strictly distinguished from physical actuation. We do not claim transducer confirmation without real telemetry.',
      suggestedAction: 'Note the purple pulse waves emanating from Transducer TX-01 and the controller status indicator.',
      scenarioPreset: 'SCENARIO_1_AVOIDANCE',
      targetPage: 'command-center',
    },
    {
      stepNumber: 4,
      stageName: 'VERIFY',
      title: 'Stage 4: Post-Intervention Response Tracking',
      subtitle: 'Observe movement in the critical 3-second window',
      icon: LineChart,
      explanation:
        'Traditional systems stop at activation and assume success. AI to Bots keeps tracking the target for 3–5 seconds post-intervention, recording angular deflection, velocity changes, and distance from the crop zone.',
      judgeKeyTakeaway:
        'This is the core paradigm shift: the system tracks what happens AFTER the sound is fired.',
      suggestedAction: 'Observe the flight path turn sharply away (158° deflection) and exit the crop boundary vector.',
      scenarioPreset: 'SCENARIO_1_AVOIDANCE',
      targetPage: 'command-center',
    },
    {
      stepNumber: 5,
      stageName: 'CLASSIFY',
      title: 'Stage 5: Honest Outcome Classification',
      subtitle: 'Rigorous scientific classification: Response vs Inconclusive',
      icon: ShieldCheck,
      explanation:
        'The system evaluates tracking quality and deflection. If tracking is lost behind foliage, it strictly assigns INCONCLUSIVE — never claiming target disappearance as deterrence. If the moth turns, it assigns "Response Observed", carefully noting that causation requires control trials.',
      judgeKeyTakeaway:
        'Loss of tracking is NOT deterrence. We maintain scientific integrity by refusing false positive claims.',
      suggestedAction: 'Review the outcome card with scientific rationale and explicit caveat notices.',
      scenarioPreset: 'SCENARIO_1_AVOIDANCE',
      targetPage: 'command-center',
    },
    {
      stepNumber: 6,
      stageName: 'COMPARE',
      title: 'Stage 6: Multi-Trial Evidence Explorer',
      subtitle: 'Control vs Treatment comparative analytics & export',
      icon: BarChart3,
      explanation:
        'Navigate to the Evidence Explorer to view comparative trials: Silent Control vs Fixed Acoustic vs AI-Controlled. Judges can inspect deflection distributions, time in crop zone, and export complete trial logs in JSON or CSV.',
      judgeKeyTakeaway:
        'True proof requires comparing against silent control baselines, where moths naturally turn ~20% of the time without any sound.',
      suggestedAction: 'Click "Jump to Evidence Explorer" to inspect the comparative analytics table and charts.',
      targetPage: 'evidence-explorer',
    },
  ];

  const currentStep = demoSteps[currentStepIndex];
  const StepIcon = currentStep.icon;

  const handleNext = () => {
    if (currentStepIndex < demoSteps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      onNavigateToPage(demoSteps[nextIndex].targetPage);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      setCurrentStepIndex(prevIndex);
      onNavigateToPage(demoSteps[prevIndex].targetPage);
    }
  };

  const handleRunSimulationForStep = (scenario: 'SCENARIO_1_AVOIDANCE' | 'SCENARIO_2_NO_RESPONSE' | 'SCENARIO_3_TRACKING_LOST') => {
    onNavigateToPage('command-center');
    onTriggerSimulation(scenario);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col">
        {/* Modal Top Bar */}
        <div className="bg-emerald-950 text-white px-6 py-4 flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-emerald-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
                JUDGE EVALUATION WALKTHROUGH
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                90-Second Proof-of-Deterrence Tour
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-1 overflow-x-auto">
          {demoSteps.map((s, idx) => (
            <button
              key={s.stepNumber}
              onClick={() => {
                setCurrentStepIndex(idx);
                onNavigateToPage(s.targetPage);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                currentStepIndex === idx
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : currentStepIndex > idx
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              <span>{s.stepNumber}.</span>
              <span className="hidden sm:inline">{s.stageName}</span>
            </button>
          ))}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* Header of the step */}
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-900 shrink-0">
              <StepIcon className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                STEP {currentStep.stepNumber} OF {demoSteps.length} &middot; {currentStep.stageName}
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {currentStep.title}
              </h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {currentStep.subtitle}
              </p>
            </div>
          </div>

          {/* Explanation text */}
          <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            {currentStep.explanation}
          </div>

          {/* Judge Key Takeaway Highlight Box */}
          <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-xl">
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>JUDGE EVALUATION CRITERION</span>
            </div>
            <p className="text-xs text-emerald-800 font-medium leading-relaxed">
              {currentStep.judgeKeyTakeaway}
            </p>
          </div>

          {/* Interactive Simulation triggers for Judges */}
          <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
            <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Test Alternative Deterministic Scenarios in Live View:</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => handleRunSimulationForStep('SCENARIO_1_AVOIDANCE')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-medium transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-emerald-700" />
                <span>Scenario 1: Deflection (Response Observed)</span>
              </button>

              <button
                onClick={() => handleRunSimulationForStep('SCENARIO_2_NO_RESPONSE')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-slate-700" />
                <span>Scenario 2: Intrusion (No Response)</span>
              </button>

              <button
                onClick={() => handleRunSimulationForStep('SCENARIO_3_TRACKING_LOST')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-medium transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                <span>Scenario 3: Occlusion (Inconclusive)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Bottom Controls */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCurrentStepIndex(0);
                onNavigateToPage(demoSteps[0].targetPage);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart Tour</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentStepIndex === 0}
              onClick={handlePrev}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                currentStepIndex === 0
                  ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {currentStepIndex < demoSteps.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Next Stage</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  onNavigateToPage('evidence-explorer');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Jump to Evidence Explorer</span>
                <CheckCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
