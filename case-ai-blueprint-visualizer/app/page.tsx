'use client';

import { useState, useRef, useEffect } from 'react';
import { blueprints, getBlueprintById, getScenarioById } from '@/lib/blueprints';
import { AnimationEngine, AnimationState } from '@/lib/animationEngine';
import { HealthChatAnimationEngine } from '@/lib/healthChatAnimationEngine';
import { cotService } from '@/lib/cotService';
import { LlmRouterAnimationEngine } from '@/lib/llmRouterAnimationEngine';
import { routerTraceService } from '@/lib/routerTraceService';
import { RAGAnimationEngine } from '@/lib/ragAnimationEngine';
import { ragTraceService } from '@/lib/ragTraceService';
import ControlBar from '@/components/ControlBar';
import BlueprintMap from '@/components/BlueprintMap';
import EventTrace from '@/components/EventTrace';
import ViewTabs, { ActiveView } from '@/components/ViewTabs';
import ConnectorRegistry from '@/components/ConnectorRegistry';
import OnboardingPipeline from '@/components/OnboardingPipeline';
import PayloadInspector from '@/components/PayloadInspector';
import YamlEditor from '@/components/YamlEditor';
import { payloadSamples } from '@/lib/connectorData';
import { PayloadInspection } from '@/lib/types';

export default function Home() {
  const [blueprintId, setBlueprintId] = useState('healthchat');
  const [scenarioId, setScenarioId] = useState('healthcare');
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [llmRouterPrompt, setLlmRouterPrompt] = useState('Explain quantum computing');
  const [ragQuery, setRagQuery] = useState('What are the system requirements for deploying NVIDIA NIM?');
  const [activeView, setActiveView] = useState<ActiveView>('map');
  const [activePayload, setActivePayload] = useState<PayloadInspection | null>(null);
  const [rightPanel, setRightPanel] = useState<'events' | 'payload'>('events');
  const [yamlEditorOpen, setYamlEditorOpen] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const animationEngineRef = useRef<
    AnimationEngine | HealthChatAnimationEngine | LlmRouterAnimationEngine | RAGAnimationEngine | null
  >(null);

  const currentBlueprint = getBlueprintById(blueprintId);
  const currentScenario = getScenarioById(blueprintId, scenarioId);

  // Initialize animation engine
  useEffect(() => {
    if (!currentBlueprint || !currentScenario) return;

    // Real-time modes
    const isHealthChat = blueprintId === 'healthchat';
    const isLlmRouter = blueprintId === 'llm-routing';
    const isNvidiaRag = blueprintId === 'nvidia-rag';

    let engine: AnimationEngine | HealthChatAnimationEngine | LlmRouterAnimationEngine | RAGAnimationEngine;

    if (isHealthChat) {
      // HealthChat real-time mode
      engine = new HealthChatAnimationEngine(
        currentBlueprint,
        currentScenario,
        (state) => {
          setAnimationState(state);
        },
        cotService
      );

      // Auto-start polling for HealthChat if not already polling
      if (!cotService.isPolling()) {
        (engine as HealthChatAnimationEngine).start();
      }
    } else if (isLlmRouter) {
      engine = new LlmRouterAnimationEngine(
        currentBlueprint,
        currentScenario,
        (state) => {
          setAnimationState(state);
        },
        routerTraceService
      );

      if (!routerTraceService.isPolling()) {
        (engine as LlmRouterAnimationEngine).start();
      }
    } else if (isNvidiaRag) {
      engine = new RAGAnimationEngine(
        currentBlueprint,
        currentScenario,
        (state) => {
          setAnimationState(state);
        },
        ragTraceService
      );

      if (!ragTraceService.isPolling()) {
        (engine as RAGAnimationEngine).start();
      }
    } else {
      // Standard mock-data mode
      engine = new AnimationEngine(
        currentBlueprint,
        currentScenario,
        (state) => {
          setAnimationState(state);
        }
      );
    }

    animationEngineRef.current = engine;
    // Initial state is set via callback, but we set it here too to avoid null state
    // eslint-disable-next-line
    setAnimationState(engine.getState());

    return () => {
      if (isHealthChat && animationEngineRef.current) {
        (animationEngineRef.current as HealthChatAnimationEngine).stop();
      }
      if (isLlmRouter && animationEngineRef.current) {
        (animationEngineRef.current as LlmRouterAnimationEngine).stop();
      }
      if (isNvidiaRag && animationEngineRef.current) {
        (animationEngineRef.current as RAGAnimationEngine).stop();
      }
      animationEngineRef.current = null;
    };
  }, [blueprintId, scenarioId, currentBlueprint, currentScenario]);

  const handleBlueprintChange = (newBlueprintId: string) => {
    setBlueprintId(newBlueprintId);
    setActiveView('map');
    setActivePayload(null);
    setRightPanel('events');
    setYamlEditorOpen(false);
    setHighlightedNodeId(null);
    const newBlueprint = getBlueprintById(newBlueprintId);
    if (newBlueprint && newBlueprint.scenarios.length > 0) {
      setScenarioId(newBlueprint.scenarios[0].id);
    }
  };

  const handleScenarioChange = (newScenarioId: string) => {
    setScenarioId(newScenarioId);
  };

  const handlePlay = () => {
    if (!animationEngineRef.current) return;

    if (animationState?.isPlaying) {
      animationEngineRef.current.pause();
    } else {
      animationEngineRef.current.play();
    }
  };

  const handleNext = () => {
    if (!animationEngineRef.current) return;
    animationEngineRef.current.next();
  };

  const handleReset = () => {
    if (!animationEngineRef.current) return;
    animationEngineRef.current.reset();
    setActivePayload(null);
  };

  const handleSpeedChange = (speed: number) => {
    if (!animationEngineRef.current) return;
    animationEngineRef.current.setSpeed(speed);
  };

  const handleLlmRouterSend = async () => {
    try {
      const payload = {
        messages: [
          {
            role: 'user',
            content: llmRouterPrompt,
          },
        ],
        stream: false,
      };
      await fetch('/api/router/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // swallow; trace endpoint will surface errors via polling
    }
  };

  const handleRagSend = async () => {
    try {
      const payload = {
        query: ragQuery,
      };
      await fetch('/api/rag/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // swallow; trace endpoint will surface errors via polling
    }
  };

  if (!currentBlueprint || !currentScenario || !animationState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const isHealthChat = blueprintId === 'healthchat';
  const isLlmRouter = blueprintId === 'llm-routing';
  const isNvidiaRag = blueprintId === 'nvidia-rag';
  const isRealTime = isHealthChat || isLlmRouter || isNvidiaRag;
  const isMetaOrchestrator = blueprintId === 'meta-orchestrator';

  // Payload Inspector: detect active api_call/native_agent nodes
  const activeApiNode = isMetaOrchestrator && activeView === 'map'
    ? animationState.nodes.find(n =>
        (n.type === 'api_call' || n.type === 'native_agent') && n.status === 'active' && payloadSamples[n.id]
      )
    : null;
  const currentPayload = activeApiNode ? payloadSamples[activeApiNode.id] : null;

  // Update payload data when a new api/agent node activates (don't force-switch panel)
  if (currentPayload && (!activePayload || activePayload.nodeId !== currentPayload.nodeId)) {
    setActivePayload(currentPayload);
  }

  const hasPayload = isMetaOrchestrator && activePayload !== null;

  return (
    <div className="min-h-screen p-8 bg-[#0f172a]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3 text-shadow">
          NVIDIA Blueprints Visualizer
        </h1>
        <p className="text-gray-300 text-lg">Interactive visualization of AI workflow patterns</p>
      </div>

      {/* Control Bar — hidden on Meta-Orchestrator non-map views */}
      {!(isMetaOrchestrator && activeView !== 'map') && (
        <ControlBar
          blueprintId={blueprintId}
          scenarioId={scenarioId}
          blueprints={blueprints.map(bp => ({ id: bp.id, name: bp.name }))}
          scenarios={currentBlueprint.scenarios.map(s => ({ id: s.id, name: s.name }))}
          isPlaying={animationState.isPlaying}
          speed={animationState.speed}
          onBlueprintChange={handleBlueprintChange}
          onScenarioChange={handleScenarioChange}
          onPlay={handlePlay}
          onNext={handleNext}
          onReset={handleReset}
          onSpeedChange={handleSpeedChange}
          currentScenarioDescription={currentScenario.description}
          isHealthChatMode={isRealTime}
          llmRouterPrompt={isLlmRouter ? llmRouterPrompt : undefined}
          onLlmRouterPromptChange={isLlmRouter ? setLlmRouterPrompt : undefined}
          onLlmRouterSend={isLlmRouter ? handleLlmRouterSend : undefined}
          ragQuery={isNvidiaRag ? ragQuery : undefined}
          onRagQueryChange={isNvidiaRag ? setRagQuery : undefined}
          onRagSend={isNvidiaRag ? handleRagSend : undefined}
        />
      )}

      {/* View Tabs — only for Meta-Orchestrator */}
      {isMetaOrchestrator && (
        <ViewTabs activeView={activeView} onViewChange={setActiveView} />
      )}

      {/* Main Content — conditional on activeView */}
      {(!isMetaOrchestrator || activeView === 'map') && (
        <div className="relative grid grid-cols-1 xl:grid-cols-5 gap-6" style={{ height: 'calc(100vh - 340px)', maxHeight: 'calc(100vh - 340px)' }}>
          <div className="xl:col-span-3 h-full relative">
            <BlueprintMap
              nodes={animationState.nodes}
              connections={currentBlueprint.connections}
              events={currentScenario.events}
              currentStep={animationState.currentStep}
              completedEvents={animationState.completedEvents}
              onApprovalConfirm={handlePlay}
              onApprovalDeny={handleReset}
              onYamlOpen={isMetaOrchestrator ? () => setYamlEditorOpen(true) : undefined}
              highlightedNodeId={highlightedNodeId}
            />
            {/* §8.7 YAML-to-Graph overlay */}
            {isMetaOrchestrator && yamlEditorOpen && (
              <YamlEditor
                onHighlightNode={setHighlightedNodeId}
                onClose={() => { setYamlEditorOpen(false); setHighlightedNodeId(null); }}
              />
            )}
          </div>
          <div className="xl:col-span-2 h-full flex flex-col">
            {/* Right panel toggle tabs — always visible for Meta-Orchestrator */}
            {isMetaOrchestrator && (
              <div className="flex gap-1 mb-3 bg-slate-900/80 border border-slate-700 rounded-lg p-1 flex-shrink-0">
                <button
                  onClick={() => setRightPanel('events')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                    rightPanel === 'events'
                      ? 'bg-slate-700 text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
                  }`}
                >
                  Event Trace
                </button>
                <button
                  onClick={() => setRightPanel('payload')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 relative ${
                    rightPanel === 'payload'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
                  }`}
                >
                  Payload Inspector
                  {rightPanel !== 'payload' && hasPayload && (
                    <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  )}
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0">
              {isMetaOrchestrator && rightPanel === 'payload' ? (
                activePayload ? (
                  <PayloadInspector
                    payload={activePayload}
                    onClose={() => { setActivePayload(null); setRightPanel('events'); }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-start pt-24 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-400">No payload captured yet</p>
                    <p className="text-xs text-gray-600 mt-1 max-w-[240px] text-center">Play the animation — payloads appear when REST API or Native Agent nodes activate</p>
                  </div>
                )
              ) : (
                <EventTrace
                  events={currentScenario.events}
                  chatMessages={currentScenario.chatMessages}
                  currentStep={animationState.currentStep}
                  completedEvents={animationState.completedEvents}
                  isRealTime={isRealTime}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {isMetaOrchestrator && activeView === 'registry' && (
        <div style={{ height: 'calc(100vh - 220px)', maxHeight: 'calc(100vh - 220px)' }}>
          <ConnectorRegistry />
        </div>
      )}

      {isMetaOrchestrator && activeView === 'onboarding' && (
        <div style={{ height: 'calc(100vh - 220px)', maxHeight: 'calc(100vh - 220px)' }}>
          <OnboardingPipeline />
        </div>
      )}
    </div>
  );
}
