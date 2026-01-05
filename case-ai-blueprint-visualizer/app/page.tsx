'use client';

import { useState, useRef, useEffect } from 'react';
import { blueprints, getBlueprintById, getScenarioById } from '@/lib/blueprints';
import { AnimationEngine, AnimationState } from '@/lib/animationEngine';
import { HealthChatAnimationEngine } from '@/lib/healthChatAnimationEngine';
import { cotService } from '@/lib/cotService';
import { LlmRouterAnimationEngine } from '@/lib/llmRouterAnimationEngine';
import { routerTraceService } from '@/lib/routerTraceService';
import ControlBar from '@/components/ControlBar';
import BlueprintMap from '@/components/BlueprintMap';
import EventTrace from '@/components/EventTrace';

export default function Home() {
  const [blueprintId, setBlueprintId] = useState('healthchat');
  const [scenarioId, setScenarioId] = useState('healthcare');
  const [animationState, setAnimationState] = useState<AnimationState | null>(null);
  const [llmRouterPrompt, setLlmRouterPrompt] = useState('Explain quantum computing');
  const animationEngineRef = useRef<
    AnimationEngine | HealthChatAnimationEngine | LlmRouterAnimationEngine | null
  >(null);

  const currentBlueprint = getBlueprintById(blueprintId);
  const currentScenario = getScenarioById(blueprintId, scenarioId);

  // Initialize animation engine
  useEffect(() => {
    if (!currentBlueprint || !currentScenario) return;
    
    // Real-time modes
    const isHealthChat = blueprintId === 'healthchat';
    const isLlmRouter = blueprintId === 'llm-routing';
    
    let engine: AnimationEngine | HealthChatAnimationEngine | LlmRouterAnimationEngine;
    
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
      animationEngineRef.current = null;
    };
  }, [blueprintId, scenarioId, currentBlueprint, currentScenario]);

  const handleBlueprintChange = (newBlueprintId: string) => {
    setBlueprintId(newBlueprintId);
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

  if (!currentBlueprint || !currentScenario || !animationState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const isHealthChat = blueprintId === 'healthchat';
  const isLlmRouter = blueprintId === 'llm-routing';
  const isRealTime = isHealthChat || isLlmRouter;

  return (
    <div className="min-h-screen p-8 bg-[#0f172a]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3 text-shadow">
          NVIDIA Blueprints Visualizer
        </h1>
        <p className="text-gray-300 text-lg">Interactive visualization of AI workflow patterns</p>
      </div>

      {/* Control Bar */}
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
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6" style={{ height: 'calc(100vh - 340px)', maxHeight: 'calc(100vh - 340px)' }}>
        {/* Blueprint Map - Takes 3 columns */}
        <div className="xl:col-span-3 h-full">
          <BlueprintMap
            nodes={animationState.nodes}
            connections={currentBlueprint.connections}
          />
        </div>

        {/* Event Trace - Takes 2 columns */}
        <div className="xl:col-span-2 h-full">
          <EventTrace
            events={currentScenario.events}
            chatMessages={currentScenario.chatMessages}
            currentStep={animationState.currentStep}
            completedEvents={animationState.completedEvents}
            isRealTime={isRealTime}
          />
        </div>
      </div>
    </div>
  );
}
