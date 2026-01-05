'use client';

import React, { useState } from 'react';
import { BlueprintNode, Connection, NodeStatus } from '@/lib/types';
import { 
  Download, 
  AlignLeft, 
  Share2, 
  GitBranch, 
  Cpu, 
  Zap, 
  Layers, 
  Settings, 
  CheckCircle, 
  Upload,
  Database,
  FileText,
  Lightbulb,
  Brain,
  ShieldCheck
} from 'lucide-react';
import NodeTooltip from './NodeTooltip';

interface BlueprintMapProps {
  nodes: BlueprintNode[];
  connections: Connection[];
}

interface TooltipState {
  visible: boolean;
  title: string;
  description: string;
  status: NodeStatus;
  x: number;
  y: number;
}

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  download: Download,
  'align-left': AlignLeft,
  'share-2': Share2,
  'git-branch': GitBranch,
  cpu: Cpu,
  zap: Zap,
  layers: Layers,
  settings: Settings,
  'check-circle': CheckCircle,
  upload: Upload,
  database: Database,
  'file-text': FileText,
  lightbulb: Lightbulb,
  brain: Brain,
  'shield-check': ShieldCheck,
};

const getNodeStyle = (status: NodeStatus) => {
  switch (status) {
    case 'active':
      return {
        borderColor: 'border-purple-500',
        iconColor: 'text-purple-400',
        glow: true,
        shadow: 'shadow-purple-500/50'
      };
    case 'completed':
      return {
        borderColor: 'border-cyan-400',
        iconColor: 'text-cyan-400',
        glow: false,
        shadow: 'shadow-cyan-500/30'
      };
    case 'upcoming':
      return {
        borderColor: 'border-yellow-400',
        iconColor: 'text-yellow-400',
        glow: false,
        shadow: 'shadow-yellow-500/30'
      };
    case 'chosen':
      return {
        borderColor: 'border-green-400',
        iconColor: 'text-green-400',
        glow: false,
        shadow: 'shadow-green-500/30'
      };
    case 'error':
      return {
        borderColor: 'border-red-500',
        iconColor: 'text-red-400',
        glow: true,
        shadow: 'shadow-red-500/50'
      };
    case 'skipped':
      return {
        borderColor: 'border-gray-600',
        iconColor: 'text-gray-500',
        glow: false,
        shadow: ''
      };
    case 'dormant':
    default:
      return {
        borderColor: 'border-white',
        iconColor: 'text-slate-400',
        glow: false,
        shadow: 'shadow-white/40'
      };
  }
};

const getConnectionStyle = (fromStatus: NodeStatus, toStatus: NodeStatus) => {
  // If either node is skipped, make connection gray and dim
  if (fromStatus === 'skipped' || toStatus === 'skipped') {
    return { color: '#4b5563', width: 1.5, animated: false, glow: false };
  }
  
  // If either node has error, make connection red
  if (fromStatus === 'error' || toStatus === 'error') {
    return { color: '#ef4444', width: 2.5, animated: false, glow: true };
  }
  
  // HIGHEST PRIORITY: if destination node is ACTIVE (running), 
  // make the incoming connection glow with purple animated line
  if (toStatus === 'active') {
    return { color: '#a855f7', width: 3, animated: true, glow: true };
  }
  
  // Check if connection should be active (from completed/active/chosen to non-dormant)
  const isActive = (fromStatus === 'completed' || fromStatus === 'active' || fromStatus === 'chosen') &&
                   (toStatus !== 'dormant');
  
  if (isActive) {
    if (toStatus === 'chosen') {
      return { color: '#10b981', width: 3, animated: false, glow: false };
    } else if (toStatus === 'upcoming') {
      return { color: '#eab308', width: 2.5, animated: false, glow: false };
    } else if (toStatus === 'completed') {
      return { color: '#06b6d4', width: 2.5, animated: false, glow: false };
    }
  }
  
  return { color: '#475569', width: 1.5, animated: false, glow: false };
};

export default function BlueprintMap({ nodes, connections }: BlueprintMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    title: '',
    description: '',
    status: 'dormant',
    x: 0,
    y: 0,
  });

  const nodeWidth = 110;
  const nodeHeight = 110;
  const padding = 70;
  
  const handleNodeHover = (node: BlueprintNode, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      title: node.label,
      description: node.description || 'No description available',
      status: node.status,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleNodeLeave = () => {
    setTooltip({ ...tooltip, visible: false });
  };
  
  const maxX = Math.max(...nodes.map(n => n.x)) + nodeWidth + padding;
  const maxY = Math.max(...nodes.map(n => n.y)) + nodeHeight + padding;
  const minX = Math.min(...nodes.map(n => n.x)) - padding;
  const minY = Math.min(...nodes.map(n => n.y)) - padding;

  const viewBoxWidth = maxX - minX;
  const viewBoxHeight = maxY - minY;

  const nodeMap = new Map(nodes.map(node => [node.id, node]));

  return (
    <>
      <NodeTooltip
        title={tooltip.title}
        description={tooltip.description}
        status={tooltip.status}
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
      />
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl p-6 h-full flex flex-col card-shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-6 text-shadow">Blueprint Map</h2>
      
      <div className="flex-1 flex items-center justify-center overflow-auto rounded-lg bg-slate-950/50 p-4">
        <svg
          viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full"
          style={{ minHeight: '500px' }}
        >
          <defs>
            {connections.map((conn, index) => {
              const fromNode = nodeMap.get(conn.from);
              const toNode = nodeMap.get(conn.to);
              if (!fromNode || !toNode) return null;
              
              const style = getConnectionStyle(fromNode.status, toNode.status);
              return (
                <marker
                  key={`marker-${index}`}
                  id={`arrowhead-${index}`}
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path
                    d="M 0 0 L 8 4 L 0 8 z"
                    fill={style.color}
                  />
                </marker>
              );
            })}
            
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Draw connections */}
          {connections.map((conn, index) => {
            const fromNode = nodeMap.get(conn.from);
            const toNode = nodeMap.get(conn.to);
            
            if (!fromNode || !toNode) return null;

            // Center points of nodes
            const fromCenterX = fromNode.x + nodeWidth / 2;
            const fromCenterY = fromNode.y + nodeHeight / 2;
            const toCenterX = toNode.x + nodeWidth / 2;
            const toCenterY = toNode.y + nodeHeight / 2;

            // Calculate angle and distance
            const angle = Math.atan2(toCenterY - fromCenterY, toCenterX - fromCenterX);
            
            // Calculate edge points (where line should start and end)
            const nodeRadius = nodeWidth / 2 + 5; // Add small gap from border
            const fromX = fromCenterX + Math.cos(angle) * nodeRadius;
            const fromY = fromCenterY + Math.sin(angle) * nodeRadius;
            
            const arrowTipOffset = nodeRadius + 10; // Extra space for arrow tip
            const toX = toCenterX - Math.cos(angle) * arrowTipOffset;
            const toY = toCenterY - Math.sin(angle) * arrowTipOffset;

            const style = getConnectionStyle(fromNode.status, toNode.status);

            return (
              <g key={`conn-${index}`}>
                <line
                  x1={fromX}
                  y1={fromY}
                  x2={toX}
                  y2={toY}
                  stroke={style.color}
                  strokeWidth={style.width}
                  markerEnd={`url(#arrowhead-${index})`}
                  strokeDasharray={style.animated ? "12,12" : "none"}
                  className={`transition-all duration-300 ${style.animated ? 'flow-animation' : ''}`}
                  style={{
                    opacity: style.animated || style.glow ? 1 : 0.5,
                    filter: style.glow ? 'url(#glow) drop-shadow(0 0 8px #a855f7)' : 'none',
                  }}
                />
              </g>
            );
          })}

          {/* Draw nodes */}
          {nodes.map((node) => {
            const style = getNodeStyle(node.status);
            const IconComponent = iconComponents[node.icon] || Cpu;
            
            return (
              <g key={node.id} className="transition-all duration-300">
                {/* Node background transparent with colored border */}
                <foreignObject
                  x={node.x}
                  y={node.y}
                  width={nodeWidth}
                  height={nodeHeight}
                >
                  <div
                    className={`w-full h-full rounded-2xl bg-transparent border-3 ${style.borderColor} ${style.shadow} shadow-xl flex flex-col items-center justify-center transition-all duration-300 ${style.glow ? 'glow-pulse' : ''} cursor-pointer`}
                    style={{
                      borderWidth: '3px',
                    }}
                    onMouseEnter={(e) => handleNodeHover(node, e)}
                    onMouseLeave={handleNodeLeave}
                  >
                    <IconComponent className={`w-12 h-12 ${style.iconColor}`} />
                  </div>
                </foreignObject>
                
                {/* Node label */}
                <text
                  x={node.x + nodeWidth / 2}
                  y={node.y + nodeHeight + 25}
                  textAnchor="middle"
                  className="text-sm font-bold text-gray-200"
                  style={{ fill: '#e5e7eb', fontSize: '15px' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Status Legend */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <div className="text-sm font-bold text-white mb-3">Status Legend</div>
        <div className="flex flex-wrap gap-4">
          {[
            { label: 'Active', borderColor: 'border-purple-500', shadowColor: 'shadow-purple-500/50' },
            { label: 'Completed', borderColor: 'border-cyan-400', shadowColor: 'shadow-cyan-500/30' },
            { label: 'Upcoming', borderColor: 'border-yellow-400', shadowColor: 'shadow-yellow-500/30' },
            { label: 'Chosen', borderColor: 'border-green-400', shadowColor: 'shadow-green-500/30' },
            { label: 'Dormant', borderColor: 'border-white', shadowColor: 'shadow-white/40' },
            { label: 'Skipped', borderColor: 'border-gray-600', shadowColor: '' },
            { label: 'Error', borderColor: 'border-red-500', shadowColor: 'shadow-red-500/50' },
          ].map((status) => (
            <div key={status.label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full bg-transparent border-2 ${status.borderColor} ${status.shadowColor} shadow-lg`}></div>
              <span className="text-xs text-gray-300">{status.label}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
