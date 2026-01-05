'use client';

import { Play, Pause, SkipForward, RotateCcw, Info } from 'lucide-react';
import Tooltip from './Tooltip';

interface ControlBarProps {
  blueprintId: string;
  scenarioId: string;
  blueprints: Array<{ id: string; name: string }>;
  scenarios: Array<{ id: string; name: string }>;
  isPlaying: boolean;
  speed: number;
  onBlueprintChange: (id: string) => void;
  onScenarioChange: (id: string) => void;
  onPlay: () => void;
  onNext: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  currentScenarioDescription?: string;
  isHealthChatMode?: boolean;
  // LLM Router real-time run controls (optional)
  llmRouterPrompt?: string;
  onLlmRouterPromptChange?: (value: string) => void;
  onLlmRouterSend?: () => void;
}

export default function ControlBar({
  blueprintId,
  scenarioId,
  blueprints,
  scenarios,
  isPlaying,
  speed,
  onBlueprintChange,
  onScenarioChange,
  onPlay,
  onNext,
  onReset,
  onSpeedChange,
  currentScenarioDescription,
  isHealthChatMode = false,
  llmRouterPrompt,
  onLlmRouterPromptChange,
  onLlmRouterSend,
}: ControlBarProps) {
  return (
    <div className="gradient-bg border border-slate-700 rounded-xl p-6 mb-6 card-shadow-lg">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left side - Scenario info and selectors */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 flex-1">
          <div className="flex items-start gap-3" style={{ width: '380px', minWidth: '380px', maxWidth: '380px' }}>
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-white font-bold">Current Scenario</span>
                <Tooltip content="The currently selected workflow scenario being visualized">
                  <Info className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help" />
                </Tooltip>
              </div>
              <div className="text-gray-100 text-sm font-medium px-3 py-2 rounded-lg line-clamp-2 overflow-hidden" style={{ minHeight: '42px', maxHeight: '42px' }}>
                {currentScenarioDescription || 'Select a scenario'}
              </div>
            </div>
          </div>

          <div className="hidden lg:block h-16 w-px bg-slate-700"></div>

          {/* Blueprint selector */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-white text-xs font-bold mb-2">Blueprint</label>
            <select
              value={blueprintId}
              onChange={(e) => onBlueprintChange(e.target.value)}
              className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg px-4 py-2.5 text-gray-100 text-sm font-medium focus:outline-none focus:border-purple-500 hover:border-slate-500 transition-colors cursor-pointer"
            >
              {blueprints.map((bp) => (
                <option key={bp.id} value={bp.id} className="bg-slate-800">
                  {bp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Scenario selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-white text-xs font-bold mb-2">Scenario</label>
            <select
              value={scenarioId}
              onChange={(e) => onScenarioChange(e.target.value)}
              disabled={isHealthChatMode}
              className={`w-full bg-slate-800 border-2 border-slate-600 rounded-lg px-4 py-2.5 text-gray-100 text-sm font-medium focus:outline-none focus:border-purple-500 hover:border-slate-500 transition-colors ${
                isHealthChatMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={isHealthChatMode ? 'Scenario is fixed for HealthChat (real-time data)' : ''}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id} className="bg-slate-800">
                  {scenario.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-6" style={{ paddingTop: '20px' }}>
          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <Tooltip content={isHealthChatMode ? 'Real-time mode (controls disabled)' : (isPlaying ? 'Pause' : 'Play')}>
              <button
                onClick={onPlay}
                disabled={isHealthChatMode}
                className={`w-12 h-12 rounded-xl ${
                  isPlaying
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600'
                    : 'bg-gradient-to-br from-blue-600 to-cyan-600'
                } border-2 ${
                  isPlaying ? 'border-purple-400' : 'border-blue-400'
                } flex items-center justify-center hover:scale-110 transition-all duration-200 card-shadow active:scale-95 ${
                  isHealthChatMode ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''
                }`}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" fill="white" />
                ) : (
                  <Play className="w-5 h-5 text-white" fill="white" />
                )}
              </button>
            </Tooltip>

            <Tooltip content={isHealthChatMode ? 'Not available in real-time mode' : 'Next Step'}>
              <button
                onClick={onNext}
                disabled={isHealthChatMode}
                className={`w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 flex items-center justify-center hover:scale-110 hover:border-slate-500 transition-all duration-200 card-shadow active:scale-95 ${
                  isHealthChatMode ? 'opacity-50 cursor-not-allowed hover:scale-100 hover:border-slate-600' : ''
                }`}
              >
                <SkipForward className="w-5 h-5 text-gray-200" />
              </button>
            </Tooltip>

            <Tooltip content="Reset">
              <button
                onClick={onReset}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 flex items-center justify-center hover:scale-110 hover:border-slate-500 transition-all duration-200 card-shadow active:scale-95"
              >
                <RotateCcw className="w-5 h-5 text-gray-200" />
              </button>
            </Tooltip>
          </div>

          <div className="hidden lg:block h-12 w-px bg-slate-700"></div>

          {/* Speed control */}
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-bold whitespace-nowrap" style={{ minWidth: '90px' }}>
              Speed: <span className={isHealthChatMode ? 'text-gray-500' : 'text-purple-400'}>{isHealthChatMode ? 'Real-time' : `${speed}x`}</span>
            </span>
            <div className="relative w-32">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={speed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                disabled={isHealthChatMode}
                className={`w-full h-2 bg-slate-700 rounded-lg appearance-none ${
                  isHealthChatMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${
                    ((speed - 0.5) / 2.5) * 100
                  }%, #334155 ${((speed - 0.5) / 2.5) * 100}%, #334155 100%)`,
                }}
              />
              <style jsx>{`
                input[type='range']::-webkit-slider-thumb {
                  appearance: none;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
                  cursor: pointer;
                  border: 3px solid #fff;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }

                input[type='range']::-webkit-slider-thumb:hover {
                  transform: scale(1.1);
                }

                input[type='range']::-moz-range-thumb {
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
                  cursor: pointer;
                  border: 3px solid #fff;
                  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }
              `}</style>
            </div>
          </div>
        </div>
      </div>

      {/* LLM Router prompt bar (only when handlers are provided) */}
      {onLlmRouterSend && onLlmRouterPromptChange && typeof llmRouterPrompt === 'string' && (
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <div className="flex-1">
              <label className="block text-white text-xs font-bold mb-2">Prompt</label>
              <input
                value={llmRouterPrompt}
                onChange={(e) => onLlmRouterPromptChange(e.target.value)}
                placeholder="Type a prompt to route and run…"
                className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg px-4 py-2.5 text-gray-100 text-sm font-medium focus:outline-none focus:border-purple-500 hover:border-slate-500 transition-colors"
              />
            </div>
            <div className="flex-shrink-0 pt-6 lg:pt-0">
              <button
                onClick={onLlmRouterSend}
                className="w-full lg:w-auto px-5 py-2.5 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 border-2 border-purple-400 text-white text-sm font-bold hover:scale-[1.02] transition-all duration-200 card-shadow active:scale-[0.99]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
