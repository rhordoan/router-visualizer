'use client';

import { NodeStatus, EventStep } from '@/lib/types';

interface NodeTooltipProps {
  title: string;
  description: string;
  status: NodeStatus;
  visible: boolean;
  x: number;
  y: number;
  nodeId?: string;
  events?: EventStep[];
}

const getStatusLabel = (status: NodeStatus): string => {
  switch (status) {
    case 'active': return 'Active';
    case 'completed': return 'Completed';
    case 'upcoming': return 'Upcoming';
    case 'chosen': return 'Chosen';
    case 'skipped': return 'Skipped';
    case 'dormant': return 'Dormant';
    case 'error': return 'Error';
    default: return 'Dormant';
  }
};

const getStatusStyle = (status: NodeStatus) => {
  switch (status) {
    case 'active':
      return 'bg-purple-500 text-white';
    case 'completed':
      return 'bg-cyan-500 text-white';
    case 'upcoming':
      return 'bg-yellow-500 text-white';
    case 'chosen':
      return 'bg-green-500 text-white';
    case 'skipped':
      return 'bg-gray-600 text-gray-300';
    case 'dormant':
      return 'bg-gray-500 text-white';
    case 'error':
      return 'bg-red-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export default function NodeTooltip({ title, description, status, visible, x, y, nodeId, events }: NodeTooltipProps) {
  if (!visible) return null;

  // Calculate tooltip position to keep it within viewport
  const tooltipWidth = 320; // max-w-sm is approximately 320px
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;

  let translateX = '-50%'; // Center by default
  let adjustedX = x;
  let arrowLeftPosition = '50%';
  let arrowTransform = 'translateX(-50%)';

  // Check if tooltip would go off left edge
  if (x - tooltipWidth / 2 < 20) {
    translateX = '0%';
    adjustedX = 20;
    const arrowLeft = x - adjustedX;
    arrowLeftPosition = `${arrowLeft}px`;
    arrowTransform = 'translateX(-50%)';
  }
  // Check if tooltip would go off right edge
  else if (x + tooltipWidth / 2 > viewportWidth - 20) {
    translateX = '-100%';
    adjustedX = viewportWidth - 20;
    const arrowLeft = x - (adjustedX - tooltipWidth);
    arrowLeftPosition = `${arrowLeft}px`;
    arrowTransform = 'translateX(-50%)';
  }

  // Build profiler spans for observability node
  const isObservability = nodeId === 'observability';
  const completedEvents = events?.filter(e => e.status === 'completed' || e.status === 'running') || [];
  const profilerSpans = isObservability && completedEvents.length > 0 ? buildProfilerSpans(completedEvents) : [];

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: `${adjustedX}px`,
        top: `${y}px`,
        transform: `translate(${translateX}, -120%)`,
      }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-2xl" style={{ width: '320px' }}>
        <h3 className="text-white font-bold text-base mb-2">{title}</h3>
        <p className="text-gray-300 text-sm leading-relaxed mb-3">{description}</p>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(status)}`}>
          {getStatusLabel(status)}
        </span>

        {/* Profiler Flame Chart for Observability */}
        {isObservability && profilerSpans.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-600">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">NeMo Profiler</h4>
            <div className="space-y-1">
              {profilerSpans.map((span, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-24 truncate" style={{ paddingLeft: `${span.depth * 8}px` }}>
                    {span.label}
                  </span>
                  <div className="flex-1 h-3 bg-slate-700 rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${span.color}`}
                      style={{ width: `${span.widthPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-mono w-12 text-right">
                    {span.duration}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Arrow */}
      <div
        className="absolute -bottom-2"
        style={{
          left: arrowLeftPosition,
          transform: arrowTransform,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '8px solid #475569',
        }}
      />
    </div>
  );
}

interface ProfilerSpan {
  label: string;
  duration: number;
  widthPct: number;
  depth: number;
  color: string;
}

function buildProfilerSpans(events: EventStep[]): ProfilerSpan[] {
  // Extract timing pairs from events to build a simple flame chart
  const spans: ProfilerSpan[] = [];
  const totalDuration = Math.max(...events.map(e => e.timing), 1);

  // Map well-known event patterns to spans
  const spanDefs: { pattern: RegExp; label: string; depth: number; color: string }[] = [
    { pattern: /react_agent.*started/i, label: 'react_agent', depth: 0, color: 'bg-purple-500' },
    { pattern: /intent.*classif/i, label: 'intent_classify', depth: 1, color: 'bg-cyan-500' },
    { pattern: /selected tool/i, label: 'tool_select', depth: 1, color: 'bg-cyan-400' },
    { pattern: /delegat/i, label: 'a2a_delegate', depth: 1, color: 'bg-purple-400' },
    { pattern: /servicenow|snow/i, label: 'snow_rest', depth: 2, color: 'bg-slate-400' },
    { pattern: /jira|atlassian/i, label: 'jira_rest', depth: 2, color: 'bg-slate-400' },
    { pattern: /processunity/i, label: 'processunity', depth: 2, color: 'bg-slate-400' },
    { pattern: /sailpoint/i, label: 'sailpoint', depth: 2, color: 'bg-slate-400' },
    { pattern: /vector|rag|kb article/i, label: 'rag_search', depth: 1, color: 'bg-cyan-300' },
    { pattern: /summariz/i, label: 'llm_summarize', depth: 1, color: 'bg-pink-400' },
    { pattern: /orchestration call/i, label: 'llm_orch', depth: 1, color: 'bg-purple-300' },
    { pattern: /approval|confirm/i, label: 'approval_gate', depth: 1, color: 'bg-amber-400' },
  ];

  for (const def of spanDefs) {
    // Find matching events to compute duration
    const matching = events.filter(e => def.pattern.test(e.message));
    if (matching.length > 0) {
      // Estimate duration from timing gap or use 200ms default
      const firstTiming = Math.min(...matching.map(e => e.timing));
      const lastTiming = Math.max(...matching.map(e => e.timing));
      const dur = lastTiming > firstTiming ? lastTiming - firstTiming : 200;
      spans.push({
        label: def.label,
        duration: dur,
        widthPct: Math.max((dur / totalDuration) * 100, 5),
        depth: def.depth,
        color: def.color,
      });
    }
  }

  // Add overall react_agent span if not present
  if (spans.length > 0 && !spans.find(s => s.label === 'react_agent')) {
    spans.unshift({
      label: 'react_agent',
      duration: totalDuration,
      widthPct: 100,
      depth: 0,
      color: 'bg-purple-500',
    });
  }

  return spans;
}

