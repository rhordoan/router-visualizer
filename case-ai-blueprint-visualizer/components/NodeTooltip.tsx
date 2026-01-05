'use client';

import { NodeStatus } from '@/lib/types';

interface NodeTooltipProps {
  title: string;
  description: string;
  status: NodeStatus;
  visible: boolean;
  x: number;
  y: number;
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

export default function NodeTooltip({ title, description, status, visible, x, y }: NodeTooltipProps) {
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
    // Arrow should be centered on the node, not the tooltip
    const arrowLeft = x - adjustedX;
    arrowLeftPosition = `${arrowLeft}px`;
    arrowTransform = 'translateX(-50%)'; // Center the arrow itself
  }
  // Check if tooltip would go off right edge
  else if (x + tooltipWidth / 2 > viewportWidth - 20) {
    translateX = '-100%';
    adjustedX = viewportWidth - 20;
    // Arrow should be centered on the node
    const arrowLeft = x - (adjustedX - tooltipWidth);
    arrowLeftPosition = `${arrowLeft}px`;
    arrowTransform = 'translateX(-50%)'; // Center the arrow itself
  }

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
      </div>
      {/* Arrow - always centered on the node */}
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

