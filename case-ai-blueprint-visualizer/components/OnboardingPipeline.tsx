'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { onboardingSteps } from '@/lib/connectorData';
import { OnboardingStep, NodeStatus } from '@/lib/types';
import { Search, FileCode, Settings, Hand, Package, Play, Pause, RotateCcw } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  search: Search,
  'file-code': FileCode,
  settings: Settings,
  hand: Hand,
  package: Package,
};

const nodeW = 120;
const nodeH = 120;
const gapX = 180;
const startX = 60;
const centerY = 160;

export default function OnboardingPipeline() {
  const [steps, setSteps] = useState<OnboardingStep[]>(onboardingSteps.map(s => ({ ...s, status: 'dormant' as NodeStatus })));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const waitingApproval = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const advanceStep = useCallback((step: number) => {
    setSteps(prev => prev.map((s, i) => {
      if (i < step) return { ...s, status: 'completed' as NodeStatus };
      if (i === step) return { ...s, status: 'active' as NodeStatus };
      return { ...s, status: 'dormant' as NodeStatus };
    }));
    setCurrentStep(step);

    // Step 3 (Human Review, index 3) pauses for approval
    if (step === 3) {
      waitingApproval.current = true;
      return;
    }

    // If past last step, mark all completed
    if (step >= onboardingSteps.length) {
      setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as NodeStatus })));
      setIsPlaying(false);
      return;
    }
  }, []);

  const scheduleNext = useCallback((step: number) => {
    timerRef.current = setTimeout(() => {
      advanceStep(step);
      if (step < onboardingSteps.length && step !== 3) {
        scheduleNext(step + 1);
      }
    }, 1800);
  }, [advanceStep]);

  const handlePlay = useCallback(() => {
    if (waitingApproval.current) return;
    if (isPlaying) {
      setIsPlaying(false);
      clearTimer();
      return;
    }
    setIsPlaying(true);
    const next = currentStep < 0 ? 0 : currentStep + 1;
    advanceStep(next);
    if (next !== 3 && next < onboardingSteps.length) {
      scheduleNext(next + 1);
    }
  }, [isPlaying, currentStep, advanceStep, scheduleNext, clearTimer]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    waitingApproval.current = false;
    clearTimer();
    setCurrentStep(-1);
    setSteps(onboardingSteps.map(s => ({ ...s, status: 'dormant' as NodeStatus })));
  }, [clearTimer]);

  const handleApprove = useCallback(() => {
    waitingApproval.current = false;
    advanceStep(4);
    timerRef.current = setTimeout(() => {
      setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as NodeStatus })));
      setIsPlaying(false);
      setCurrentStep(5);
    }, 1800);
  }, [advanceStep]);

  const handleDeny = useCallback(() => {
    handleReset();
  }, [handleReset]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const svgW = startX + onboardingSteps.length * (nodeW + gapX);
  const svgH = centerY + nodeH + 80;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl card-shadow-lg overflow-hidden">
      {/* Header + controls */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white text-shadow">AI-Assisted Onboarding Pipeline</h2>
          <p className="text-sm text-gray-400 mt-1">5-step connector onboarding flow</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlay}
            disabled={waitingApproval.current}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 card-shadow ${
              isPlaying
                ? 'bg-gradient-to-br from-purple-600 to-pink-600 border-2 border-purple-400'
                : 'bg-gradient-to-br from-blue-600 to-cyan-600 border-2 border-blue-400'
            } ${waitingApproval.current ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}`}
          >
            {isPlaying ? <Pause className="w-4 h-4 text-white" fill="white" /> : <Play className="w-4 h-4 text-white" fill="white" />}
          </button>
          <button
            onClick={handleReset}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600 flex items-center justify-center hover:scale-110 transition-all duration-200 card-shadow active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-gray-200" />
          </button>
        </div>
      </div>

      {/* Pipeline SVG */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-6">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full" style={{ maxHeight: '400px' }}>
          {/* Connections */}
          {steps.map((_, i) => {
            if (i === steps.length - 1) return null;
            const x1 = startX + i * (nodeW + gapX) + nodeW + 5;
            const x2 = startX + (i + 1) * (nodeW + gapX) - 15;
            const y = centerY + nodeH / 2;
            const leftDone = steps[i].status === 'completed' || steps[i].status === 'active';
            const rightActive = steps[i + 1].status === 'active';
            const rightDone = steps[i + 1].status === 'completed';
            const color = rightActive ? '#a855f7' : (leftDone && rightDone) ? '#06b6d4' : '#475569';
            const w = rightActive ? 3 : leftDone ? 2.5 : 1.5;
            const dash = rightActive ? '12,12' : 'none';
            return (
              <g key={`conn-${i}`}>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={w} strokeDasharray={dash}
                  className={rightActive ? 'flow-animation' : ''}
                  style={{ opacity: rightActive ? 1 : leftDone ? 0.7 : 0.3 }}
                />
                <polygon
                  points={`${x2},${y - 5} ${x2 + 10},${y} ${x2},${y + 5}`}
                  fill={color}
                  opacity={rightActive ? 1 : leftDone ? 0.7 : 0.3}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {steps.map((step, i) => {
            const x = startX + i * (nodeW + gapX);
            const Icon = iconMap[step.icon] || Search;
            const isActive = step.status === 'active';
            const isDone = step.status === 'completed';
            const isApprovalStep = step.id === 'onboard-review';
            const isPromoteStep = step.id === 'onboard-promote';

            let borderColor = '#475569';
            let iconColorClass = 'text-slate-400';
            let glow = false;

            if (isActive && isApprovalStep) {
              borderColor = '#f59e0b';
              iconColorClass = 'text-amber-400';
              glow = true;
            } else if (isActive) {
              borderColor = '#a855f7';
              iconColorClass = 'text-purple-400';
              glow = true;
            } else if (isDone && isPromoteStep) {
              borderColor = '#10b981';
              iconColorClass = 'text-green-400';
            } else if (isDone) {
              borderColor = '#06b6d4';
              iconColorClass = 'text-cyan-400';
            }

            return (
              <g key={step.id}>
                {/* Glow ring for active */}
                {glow && (
                  <rect x={x - 4} y={centerY - 4} width={nodeW + 8} height={nodeH + 8} rx={20}
                    fill="none" stroke={borderColor} strokeWidth={2} opacity={0.5} className="animate-pulse" />
                )}
                <foreignObject x={x} y={centerY} width={nodeW} height={nodeH}>
                  <div
                    className="w-full h-full rounded-2xl bg-transparent flex items-center justify-center transition-all duration-300"
                    style={{
                      borderWidth: '3px',
                      borderStyle: 'solid',
                      borderColor,
                      boxShadow: glow ? `0 0 20px ${borderColor}40` : 'none',
                    }}
                  >
                    <Icon className={`w-12 h-12 ${iconColorClass}`} />
                  </div>
                </foreignObject>
                <text x={x + nodeW / 2} y={centerY + nodeH + 28} textAnchor="middle"
                  style={{ fill: '#e5e7eb', fontSize: '14px', fontWeight: 700 }}>
                  {step.label}
                </text>
                <text x={x + nodeW / 2} y={centerY + nodeH + 48} textAnchor="middle"
                  style={{ fill: '#9ca3af', fontSize: '10px', fontWeight: 400 }}>
                  {isDone ? 'Completed' : isActive ? (isApprovalStep ? 'Awaiting Review' : 'Processing...') : ''}
                </text>

                {/* Approval buttons */}
                {isActive && isApprovalStep && waitingApproval.current && (
                  <foreignObject x={x - 5} y={centerY + nodeH + 56} width={nodeW + 10} height={28}>
                    <div className="flex gap-1 justify-center">
                      <button onClick={handleApprove}
                        className="px-2.5 py-0.5 rounded-full bg-green-600/80 text-white text-[10px] font-bold border border-green-400/60 hover:bg-green-500 transition-colors cursor-pointer">
                        Approve
                      </button>
                      <button onClick={handleDeny}
                        className="px-2.5 py-0.5 rounded-full bg-red-600/80 text-white text-[10px] font-bold border border-red-400/60 hover:bg-red-500 transition-colors cursor-pointer">
                        Deny
                      </button>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
