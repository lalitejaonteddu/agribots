import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/common/Header';
import { Sidebar, PageId } from './components/common/Sidebar';
import { Footer } from './components/common/Footer';
import { JudgeDemoModal } from './components/judgeDemo/JudgeDemoModal';
import { CommandCenter } from './pages/CommandCenter';
import { LiveObservationPage } from './pages/LiveObservationPage';
import { InterventionLabPage } from './pages/InterventionLabPage';
import { EvidenceExplorerPage } from './pages/EvidenceExplorerPage';
import { SystemArchitecturePage } from './pages/SystemArchitecturePage';
import { HardwareSettingsPage } from './pages/HardwareSettingsPage';
import { PestSimulationEngine, SimulationState } from './services/simulationEngine';
import { getStoredTrials, resetStoredTrials, calculateKpis, saveTrial } from './services/storage';
import { TrialRecord } from './types';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('command-center');
  const [isJudgeDemoOpen, setIsJudgeDemoOpen] = useState<boolean>(false);
  const [trials, setTrials] = useState<TrialRecord[]>(() => getStoredTrials());

  // Instantiate simulation engine once with persistent callbacks
  const [simulationState, setSimulationState] = useState<SimulationState | null>(null);

  const engine = useMemo(() => {
    return new PestSimulationEngine({
      onUpdate: (state) => {
        setSimulationState({ ...state });
      },
      onEvent: () => {
        // Event received
      },
      onComplete: (trial: TrialRecord) => {
        saveTrial(trial);
        setTrials(getStoredTrials());
      },
    });
  }, []);

  // Set initial state from engine
  const activeState = simulationState || engine.getState();

  useEffect(() => {
    return () => {
      engine.stopTrial();
    };
  }, [engine]);

  const kpis = calculateKpis(trials);

  const handleResetData = () => {
    const fresh = resetStoredTrials();
    setTrials(fresh);
    engine.reset();
  };

  const handleTriggerSimulationFromDemo = (
    scenario: 'SCENARIO_1_AVOIDANCE' | 'SCENARIO_2_NO_RESPONSE' | 'SCENARIO_3_TRACKING_LOST'
  ) => {
    engine.startTrial('AI_CONTROLLED', scenario, 'Helicoverpa armigera');
  };

  const handleTrialSaved = () => {
    setTrials(getStoredTrials());
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Persistent Left Navigation Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        trialsCount={trials.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Global Application Header */}
        <Header
          onStartJudgeDemo={() => setIsJudgeDemoOpen(true)}
          onResetData={handleResetData}
          systemStage={activeState.stage}
          isSimulating={activeState.isRunning}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {currentPage === 'command-center' && (
              <CommandCenter
                simulationState={activeState}
                simulationEngine={engine}
                kpis={kpis}
                onOpenJudgeDemo={() => setIsJudgeDemoOpen(true)}
                onSelectCondition={() => {
                  setCurrentPage('intervention-lab');
                }}
              />
            )}

            {currentPage === 'live-observation' && (
              <LiveObservationPage
                simulationState={activeState}
                simulationEngine={engine}
              />
            )}

            {currentPage === 'intervention-lab' && (
              <InterventionLabPage
                simulationState={activeState}
                simulationEngine={engine}
                onTrialSaved={handleTrialSaved}
              />
            )}

            {currentPage === 'evidence-explorer' && (
              <EvidenceExplorerPage
                trials={trials}
                onResetData={handleResetData}
              />
            )}

            {currentPage === 'system-architecture' && (
              <SystemArchitecturePage />
            )}

            {currentPage === 'hardware-settings' && (
              <HardwareSettingsPage />
            )}
          </div>
        </main>

        {/* Global Footer */}
        <Footer />
      </div>

      {/* Judge Demonstration Mode Guided Walkthrough Modal */}
      <JudgeDemoModal
        isOpen={isJudgeDemoOpen}
        onClose={() => setIsJudgeDemoOpen(false)}
        onNavigateToPage={(page) => setCurrentPage(page)}
        onTriggerSimulation={handleTriggerSimulationFromDemo}
      />
    </div>
  );
}

export default App;
