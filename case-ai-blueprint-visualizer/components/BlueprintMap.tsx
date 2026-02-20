'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BlueprintNode, Connection, NodeStatus, EventStep } from '@/lib/types';
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
  ShieldCheck,
  MessageSquare,
  ListTodo,
  Bell,
  ClipboardList,
  Calendar,
  Server,
  FileCode,
  ArrowRightLeft,
  Hand,
  Activity,
  Monitor,
  Users,
  DollarSign,
  ShieldAlert,
  Fingerprint,
  Bot,
  Globe,
  Search,
  Package,
  RotateCw,
  Lock
} from 'lucide-react';
import NodeTooltip from './NodeTooltip';

interface BlueprintMapProps {
  nodes: BlueprintNode[];
  connections: Connection[];
  events?: EventStep[];
  currentStep?: number;
  completedEvents?: string[];
  onApprovalConfirm?: () => void;
  onApprovalDeny?: () => void;
  onYamlOpen?: () => void;
  highlightedNodeId?: string | null;
}

interface TooltipState {
  visible: boolean;
  title: string;
  description: string;
  status: NodeStatus;
  x: number;
  y: number;
  nodeId?: string;
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
  'message-square': MessageSquare,
  'list-todo': ListTodo,
  bell: Bell,
  'clipboard-list': ClipboardList,
  calendar: Calendar,
  server: Server,
  'file-code': FileCode,
  'arrow-right-left': ArrowRightLeft,
  hand: Hand,
  activity: Activity,
  monitor: Monitor,
  users: Users,
  'dollar-sign': DollarSign,
  'shield-alert': ShieldAlert,
  fingerprint: Fingerprint,
  bot: Bot,
  globe: Globe,
  search: Search,
  package: Package,
  'rotate-cw': RotateCw,
  lock: Lock,
};

// Type-based colors for dormant nodes (per §11 Color Palette)
const getTypeColors = (type: string) => {
  switch (type) {
    case 'helpbot':
      return { borderColor: 'border-blue-400', iconColor: 'text-blue-400', shadow: 'shadow-blue-500/30' };
    case 'orchestrator':
    case 'classify':
    case 'route':
      return { borderColor: 'border-purple-400', iconColor: 'text-purple-400', shadow: 'shadow-purple-500/30' };
    case 'config':
      return { borderColor: 'border-purple-300', iconColor: 'text-purple-300', shadow: 'shadow-purple-400/20' };
    case 'domain_agent':
      return { borderColor: 'border-amber-400', iconColor: 'text-amber-400', shadow: 'shadow-amber-500/30' };
    case 'native_agent':
      return { borderColor: 'border-indigo-400', iconColor: 'text-indigo-400', shadow: 'shadow-indigo-500/30' };
    case 'api_call':
    case 'platform':
      return { borderColor: 'border-slate-400', iconColor: 'text-slate-400', shadow: 'shadow-slate-500/30' };
    case 'approval':
      return { borderColor: 'border-amber-500', iconColor: 'text-amber-400', shadow: 'shadow-amber-500/30' };
    case 'vectordb':
    case 'retrieval':
    case 'llm':
    case 'embedder':
    case 'nim':
    case 'registry':
      return { borderColor: 'border-cyan-400', iconColor: 'text-cyan-400', shadow: 'shadow-cyan-500/30' };
    case 'observability':
      return { borderColor: 'border-gray-400', iconColor: 'text-gray-400', shadow: 'shadow-gray-500/20' };
    default:
      return { borderColor: 'border-slate-500', iconColor: 'text-slate-400', shadow: 'shadow-white/20' };
  }
};

const getNodeStyle = (status: NodeStatus, type?: string) => {
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
    default: {
      // Use type-specific colors when dormant
      if (type) {
        const typeColors = getTypeColors(type);
        return { ...typeColors, glow: false };
      }
      return {
        borderColor: 'border-white',
        iconColor: 'text-slate-400',
        glow: false,
        shadow: 'shadow-white/40'
      };
    }
  }
};

const getConnectionStyle = (fromStatus: NodeStatus, toStatus: NodeStatus, fromType?: string, toType?: string, fromId?: string, toId?: string) => {
  const isNativeAgentConn = toType === 'native_agent' || fromType === 'native_agent';
  const isApprovalConn = toType === 'approval' || fromType === 'approval';

  // §3.2: react-agent → observability: thin dotted gray always visible
  if (fromId === 'react-agent' && toId === 'observability') {
    return { color: '#64748b', width: 1, animated: false, glow: false, dashed: false, dotted: true, label: '' };
  }

  // §3.5: NIM connections — thin gray
  if (toId === 'nim-services') {
    return { color: '#64748b', width: 1, animated: false, glow: false, dashed: false, dotted: false, label: '' };
  }

  // If either node is skipped, dim gray
  if (fromStatus === 'skipped' || toStatus === 'skipped') {
    return { color: '#4b5563', width: 1.5, animated: false, glow: false, dashed: false, dotted: false, label: '' };
  }

  // Error → red
  if (fromStatus === 'error' || toStatus === 'error') {
    return { color: '#ef4444', width: 2.5, animated: false, glow: true, dashed: false, dotted: false, label: '' };
  }

  // §3.2: approval-gate → a2a-delegate: solid green when approved
  if (fromId === 'approval-gate' && toId === 'a2a-delegate' && fromStatus === 'completed') {
    return { color: '#10b981', width: 2.5, animated: false, glow: false, dashed: false, dotted: false, label: '' };
  }

  // §3.6: nat-serve → helpbot-chat (final answer): solid green
  if (fromId === 'nat-serve' && toId === 'helpbot-chat' && fromStatus === 'completed') {
    return { color: '#10b981', width: 2.5, animated: false, glow: false, dashed: false, dotted: false, label: '' };
  }

  // ACTIVE destination
  if (toStatus === 'active') {
    // §3.2: tool-select → approval-gate: animated dashed amber
    if (isApprovalConn) {
      return { color: '#f59e0b', width: 3, animated: true, glow: true, dashed: true, dotted: false, label: '' };
    }
    // §3.5: RAG connections — animated cyan
    if (toId === 'rag-tool' || toId === 'vectordb' || toId === 'embedder') {
      return { color: '#06b6d4', width: 3, animated: true, glow: true, dashed: false, dotted: false, label: '' };
    }
    // §3.3: A2A delegation connections — animated purple with label
    if (fromId === 'a2a-delegate') {
      return { color: '#a855f7', width: 3, animated: true, glow: true, dashed: false, dotted: false, label: 'A2A' };
    }
    return { color: '#a855f7', width: 3, animated: true, glow: true, dashed: isNativeAgentConn, dotted: false, label: '' };
  }

  // Active/completed/chosen → non-dormant paths
  const isActive = (fromStatus === 'completed' || fromStatus === 'active' || fromStatus === 'chosen') &&
    (toStatus !== 'dormant');

  if (isActive) {
    // §3.3: A2A chosen path — add label
    const isA2A = fromId === 'a2a-delegate';

    if (toStatus === 'chosen') {
      return { color: '#10b981', width: 3, animated: false, glow: false, dashed: false, dotted: false, label: isA2A ? 'A2A' : '' };
    }
    if (toStatus === 'upcoming') {
      return { color: '#eab308', width: 2.5, animated: false, glow: false, dashed: isNativeAgentConn, dotted: false, label: '' };
    }
    if (toStatus === 'completed') {
      // §3.2: intent-classify → tool-select: solid cyan when completed
      // §3.5: RAG/vector connections: solid cyan when completed
      if (toId === 'tool-select' || toId === 'vectordb' || toId === 'embedder' || toId === 'rag-tool') {
        return { color: '#06b6d4', width: 2.5, animated: false, glow: false, dashed: false, dotted: false, label: '' };
      }
      // §3.6: Response path — solid cyan
      return { color: '#06b6d4', width: 2.5, animated: false, glow: false, dashed: isNativeAgentConn, dotted: false, label: isA2A ? 'A2A' : '' };
    }
  }

  // §3.2: nat-serve → workflow-config: thin cyan (one-time init)
  if (fromId === 'nat-serve' && toId === 'workflow-config') {
    return { color: '#06b6d4', width: 1, animated: false, glow: false, dashed: false, dotted: false, label: '' };
  }

  // Dormant: keep type-based dashing
  if (isNativeAgentConn) {
    return { color: '#6366f1', width: 1.5, animated: false, glow: false, dashed: true, dotted: false, label: '' };
  }
  if (isApprovalConn) {
    return { color: '#92400e', width: 1.5, animated: false, glow: false, dashed: true, dotted: false, label: '' };
  }
  return { color: '#475569', width: 1.5, animated: false, glow: false, dashed: false, dotted: false, label: '' };
};

// Map OTel tool names from event messages to node IDs in the blueprint
const mapToolToNodeId = (toolName: string): string | null => {
  const map: Record<string, string> = {
    'tool.servicenow_rest': 'snow-rest',
    'tool.servicenow': 'snow-rest',
    'tool.jira_rest': 'atl-rest',
    'tool.jira': 'atl-rest',
    'tool.atlassian': 'atl-rest',
    'tool.m365_graph': 'm365-graph',
    'tool.graph': 'm365-graph',
    'tool.oracle': 'oracle-rest',
    'tool.processunity': 'pu-rest',
    'tool.sailpoint': 'sailpoint-rest',
    'tool.harbor': 'sailpoint-harbor',
    'tool.snowassist': 'snow-nowassist',
    'tool.nowassist': 'snow-nowassist',
    'tool.agentforce': 'sf-agentforce',
    'tool.copilot': 'm365-copilot',
    'tool.vectordb': 'vectordb',
    'tool.rag': 'rag-tool',
    'tool.embedder': 'embedder',
    'tool.llm': 'llm-orchestration',
    'tool.summarize': 'llm-summarize',
  };
  return map[toolName] || null;
};

// Detect if a node is in auth-pending state based on current events
const getAuthPendingNodes = (events?: EventStep[], currentStep?: number): Set<string> => {
  const authNodes = new Set<string>();
  if (!events || !currentStep) return authNodes;
  const currentEvents = events.slice(0, currentStep);
  for (const evt of currentEvents) {
    if (evt.status !== 'running') continue;
    const msg = evt.message.toLowerCase();
    if (!msg.includes('step-up auth') && !msg.includes('auth required')) continue;
    const authIdx = events.indexOf(evt);
    const laterEvents = events.slice(authIdx + 1, currentStep);
    const resolved = laterEvents.some(e => e.nodeIds.some(nid => evt.nodeIds.includes(nid)) && e.status !== 'running');
    if (!resolved) {
      for (const nid of evt.nodeIds) authNodes.add(nid);
    }
  }
  return authNodes;
};

export default function BlueprintMap({ nodes, connections, events, currentStep, completedEvents, onApprovalConfirm, onApprovalDeny, onYamlOpen, highlightedNodeId }: BlueprintMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    title: '',
    description: '',
    status: 'dormant',
    x: 0,
    y: 0,
    nodeId: undefined,
  });

  // §8.1 OTel latency badges with fade-in/fade-out
  interface LatencyBadge {
    id: string;
    nodeId: string;
    label: string;
    timestamp: number;
  }
  const [latencyBadges, setLatencyBadges] = useState<LatencyBadge[]>([]);
  const lastProcessedStep = useRef(0);

  useEffect(() => {
    if (!events || !currentStep || currentStep <= lastProcessedStep.current) return;

    // Check events between last processed and current step for OTel spans
    const newEvents = events.slice(lastProcessedStep.current, currentStep);
    lastProcessedStep.current = currentStep;

    const newBadges: LatencyBadge[] = [];
    for (const evt of newEvents) {
      if (evt.status !== 'completed' && evt.status !== 'running') continue;
      // Match patterns like `tool.servicenow_rest` 142ms or (450ms)
      const toolMatches = [...evt.message.matchAll(/`([^`]+)`\s*(\d+)ms/g)];
      const parenMatches = [...evt.message.matchAll(/\((\d+)ms\)/g)];

      if (toolMatches.length > 0) {
        for (const m of toolMatches) {
          const toolName = m[1];
          const ms = m[2];
          // Map tool names to node IDs
          const nodeId = mapToolToNodeId(toolName);
          if (nodeId) {
            newBadges.push({ id: `${evt.id}-${toolName}`, nodeId, label: `${ms}ms`, timestamp: Date.now() });
          }
        }
      } else if (parenMatches.length > 0 && evt.nodeIds.length > 0) {
        // Use nodeIds from the event
        newBadges.push({ id: evt.id, nodeId: evt.nodeIds[0], label: `${parenMatches[0][1]}ms`, timestamp: Date.now() });
      }
    }

    if (newBadges.length > 0) {
      setLatencyBadges(prev => [...prev, ...newBadges]);
      // Remove badges after 2.5s
      setTimeout(() => {
        setLatencyBadges(prev => prev.filter(b => !newBadges.find(nb => nb.id === b.id)));
      }, 2500);
    }
  }, [currentStep, events]);

  // Reset badges when simulation restarts
  useEffect(() => {
    if (currentStep === 0) {
      lastProcessedStep.current = 0;
      setLatencyBadges([]);
    }
  }, [currentStep]);

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
      nodeId: node.id,
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
  const authPendingNodes = getAuthPendingNodes(events, currentStep);

  // Build visible events for latency badges
  const visibleEvents = events && currentStep ? events.slice(0, currentStep) : [];

  // Extract latency info: map nodeId -> latency string from event messages
  const nodeLatencies = new Map<string, string>();
  for (const evt of visibleEvents) {
    // Extract latencies like "(142ms)" or "(89ms)" from event messages
    const latencyMatch = evt.message.match(/\((\d+)ms\)/);
    if (latencyMatch && evt.nodeIds) {
      for (const nid of evt.nodeIds) {
        nodeLatencies.set(nid, `${latencyMatch[1]}ms`);
      }
    }
  }

  return (
    <>
      <NodeTooltip
        title={tooltip.title}
        description={tooltip.description}
        status={tooltip.status}
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        nodeId={tooltip.nodeId}
        events={visibleEvents.length > 0 ? visibleEvents : undefined}
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

                const style = getConnectionStyle(fromNode.status, toNode.status, fromNode.type, toNode.type, conn.from, conn.to);
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

              {/* Packet dot gradient */}
              <radialGradient id="packetGradient" cx="40%" cy="40%">
                <stop offset="0%" stopColor="#e9d5ff" />
                <stop offset="40%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7c3aed" />
              </radialGradient>

              {/* Glow filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Draw layer bands if nodes have layer info */}
            {(() => {
              const hasLayers = nodes.some(n => n.layer !== undefined);
              if (!hasLayers) return null;
              const layerConfig = [
                { layer: 1, label: 'Layer 1: HelpBot UI', tint: 'rgba(59,130,246,0.04)', border: 'rgba(59,130,246,0.12)' },
                { layer: 2, label: 'Layer 2: NeMo Orchestrator', tint: 'rgba(168,85,247,0.04)', border: 'rgba(168,85,247,0.12)' },
                { layer: 3, label: 'Layer 3: Domain & Platform Agents', tint: 'rgba(234,179,8,0.04)', border: 'rgba(234,179,8,0.12)' },
                { layer: 4, label: 'Layer 4: Data & Models', tint: 'rgba(6,182,212,0.04)', border: 'rgba(6,182,212,0.12)' },
              ];

              // Compute each layer's natural top and bottom from node positions
              const layerBounds = layerConfig.map(lc => {
                const layerNodes = nodes.filter(n => n.layer === lc.layer);
                if (layerNodes.length === 0) return null;
                return {
                  ...lc,
                  nodeTop: Math.min(...layerNodes.map(n => n.y)),
                  nodeBottom: Math.max(...layerNodes.map(n => n.y)) + nodeHeight,
                };
              });

              // Calculate non-overlapping band ranges using midpoints between layers
              return layerBounds.map((lb, idx) => {
                if (!lb) return null;
                const prevBottom = idx > 0 && layerBounds[idx - 1]
                  ? layerBounds[idx - 1]!.nodeBottom
                  : null;
                const nextTop = idx < layerBounds.length - 1 && layerBounds[idx + 1]
                  ? layerBounds[idx + 1]!.nodeTop
                  : null;

                const bandTop = prevBottom !== null
                  ? prevBottom + (lb.nodeTop - prevBottom) / 2
                  : lb.nodeTop - 20;
                const bandBottom = nextTop !== null
                  ? lb.nodeBottom + (nextTop - lb.nodeBottom) / 2
                  : lb.nodeBottom + 40;

                return (
                  <g key={`layer-${lb.layer}`}>
                    <rect
                      x={minX}
                      y={bandTop}
                      width={viewBoxWidth}
                      height={bandBottom - bandTop}
                      fill={lb.tint}
                      stroke={lb.border}
                      strokeWidth={1}
                      rx={8}
                    />
                    <text
                      x={minX + 12}
                      y={bandTop + 18}
                      style={{ fill: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
                    >
                      {lb.label}
                    </text>
                  </g>
                );
              });
            })()}

            {/* §8.1 Observability dotted gray lines — only drawn to nodes that are currently active */}
            {(() => {
              const obsNode = nodeMap.get('observability');
              if (!obsNode) return null;
              const obsCX = obsNode.x + nodeWidth / 2;
              const obsCY = obsNode.y + nodeHeight / 2;
              // Only trace to nodes that are actively running right now; exclude thought-loop (ring overlay, not a box)
              const targetNodes = nodes.filter(n =>
                n.id !== 'observability' &&
                n.id !== 'thought-loop' &&
                (n.layer === 2 || n.layer === 3) &&
                n.status === 'active'
              );
              return targetNodes.map(n => {
                const tCX = n.x + nodeWidth / 2;
                const tCY = n.y + nodeHeight / 2;
                const angle = Math.atan2(tCY - obsCY, tCX - obsCX);
                const r = nodeWidth / 2 + 6;
                const x1 = obsCX + Math.cos(angle) * r;
                const y1 = obsCY + Math.sin(angle) * r;
                const x2 = tCX - Math.cos(angle) * r;
                const y2 = tCY - Math.sin(angle) * r;
                return (
                  <line
                    key={`obs-line-${n.id}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4,5"
                    opacity={0.6}
                  />
                );
              });
            })()}

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

              let style = getConnectionStyle(fromNode.status, toNode.status, fromNode.type, toNode.type, conn.from, conn.to);

              // §8.4: Override to dashed amber for connections to auth-pending nodes
              if (authPendingNodes.has(conn.to)) {
                style = { color: '#f59e0b', width: 2.5, animated: true, glow: true, dashed: true, dotted: false, label: '' };
              }

              // Determine stroke dash pattern
              const dashArray = style.animated ? '12,12'
                : style.dotted ? '4,4'
                  : style.dashed ? '8,6'
                    : 'none';

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
                    strokeDasharray={dashArray}
                    className={`transition-all duration-300 ${style.animated ? 'flow-animation' : ''}`}
                    style={{
                      opacity: style.animated || style.glow ? 1 : (style.dashed ? 0.6 : 0.5),
                      filter: style.glow ? `url(#glow) drop-shadow(0 0 8px ${style.color})` : 'none',
                    }}
                  />
                </g>
              );
            })}

            {/* Connection labels (e.g. 'A2A') */}
            {connections.map((conn, index) => {
              const fromNode = nodeMap.get(conn.from);
              const toNode = nodeMap.get(conn.to);
              if (!fromNode || !toNode) return null;

              const style = getConnectionStyle(fromNode.status, toNode.status, fromNode.type, toNode.type, conn.from, conn.to);
              if (!style.label) return null;

              const midX = (fromNode.x + toNode.x) / 2 + nodeWidth / 2;
              const midY = (fromNode.y + toNode.y) / 2 + nodeHeight / 2;

              return (
                <g key={`label-${index}`}>
                  <rect
                    x={midX - 16}
                    y={midY - 9}
                    width={32}
                    height={16}
                    rx={8}
                    fill="#0f172a"
                    stroke={style.color}
                    strokeWidth={1}
                    opacity={0.9}
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    style={{ fill: style.color, fontSize: '8px', fontWeight: 700, fontFamily: 'monospace' }}
                  >
                    {style.label}
                  </text>
                </g>
              );
            })}

            {/* Draw nodes */}
            {nodes.map((node) => {
              // thought-loop is rendered as a ring overlay on react-agent, not a standalone box
              if (node.id === 'thought-loop') return null;

              const style = getNodeStyle(node.status, node.type);
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
                      onClick={node.id === 'workflow-config' && onYamlOpen ? onYamlOpen : undefined}
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

            {/* §8.7 Highlighted node glow ring from YAML editor hover */}
            {highlightedNodeId && (() => {
              const hlNode = nodeMap.get(highlightedNodeId);
              if (!hlNode) return null;
              return (
                <rect
                  x={hlNode.x - 6}
                  y={hlNode.y - 6}
                  width={nodeWidth + 12}
                  height={nodeHeight + 12}
                  rx={22}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  opacity={0.85}
                  className="animate-pulse"
                  style={{ filter: 'drop-shadow(0 0 12px #06b6d4) drop-shadow(0 0 4px #22d3ee)' }}
                />
              );
            })()}

            {/* §2.2 ReAct thought-loop — spinning dashed ring on react-agent when it is active/completed */}
            {(() => {
              const reactNode = nodeMap.get('react-agent');
              if (!reactNode) return null;

              const isVisible = reactNode.status === 'active' || reactNode.status === 'completed';
              if (!isVisible) return null;

              const cx = reactNode.x + nodeWidth / 2;
              const cy = reactNode.y + nodeHeight / 2;
              const r = nodeWidth / 2 + 16;
              const isActive = reactNode.status === 'active';
              const ringColor = isActive ? '#a855f7' : '#6b7280';
              const ringOpacity = isActive ? 0.85 : 0.35;

              return (
                <g>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={2.5}
                    strokeDasharray="12,7"
                    opacity={ringOpacity}
                  >
                    {isActive && (
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${cx} ${cy}`}
                        to={`360 ${cx} ${cy}`}
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    )}
                  </circle>
                  {isActive && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r + 5}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth={1}
                      opacity={0.2}
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })()}



            {/* Approval Gate overlay with Confirm/Deny buttons */}
            {nodes.map((node) => {
              if (node.id !== 'approval-gate' || node.status !== 'active') return null;
              return (
                <g key="approval-overlay">
                  {/* Amber pulsing ring */}
                  <rect
                    x={node.x - 4}
                    y={node.y - 4}
                    width={nodeWidth + 8}
                    height={nodeHeight + 8}
                    rx={20}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    opacity={0.7}
                    className="animate-pulse"
                  />
                  {/* Confirm / Deny buttons — positioned below the node label (label sits at nodeHeight+25, ~15px tall) */}
                  <foreignObject
                    x={node.x - 10}
                    y={node.y + nodeHeight + 46}
                    width={nodeWidth + 20}
                    height={26}
                  >
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={onApprovalConfirm}
                        className="px-2 py-0.5 rounded-full bg-green-600/80 text-white text-[9px] font-bold border border-green-400/60 hover:bg-green-500 transition-colors cursor-pointer shadow-lg shadow-green-500/20"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={onApprovalDeny}
                        className="px-2 py-0.5 rounded-full bg-red-600/80 text-white text-[9px] font-bold border border-red-400/60 hover:bg-red-500 transition-colors cursor-pointer shadow-lg shadow-red-500/20"
                      >
                        ✗ Deny
                      </button>
                    </div>
                  </foreignObject>
                </g>
              );
            })}

            {/* §8.1 OTel latency badges with fade animation */}
            {latencyBadges.map((badge) => {
              const node = nodeMap.get(badge.nodeId);
              if (!node) return null;

              // Position badge above-right of the node
              const bx = node.x + nodeWidth - 5;
              const by = node.y - 8;

              return (
                <g key={badge.id} className="otel-badge-fade">
                  <rect
                    x={bx}
                    y={by}
                    width={38}
                    height={16}
                    rx={8}
                    fill="#0f172a"
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <text
                    x={bx + 19}
                    y={by + 11}
                    textAnchor="middle"
                    style={{ fill: '#94a3b8', fontSize: '8px', fontWeight: 700, fontFamily: 'monospace' }}
                  >
                    {badge.label}
                  </text>
                </g>
              );
            })}

            {/* §8.3 nat eval testing indicator on tool-registry */}
            {(() => {
              const regNode = nodeMap.get('tool-registry');
              if (!regNode || (regNode.status !== 'active' && regNode.status !== 'completed')) return null;

              const bx = regNode.x + nodeWidth + 4;
              const by = regNode.y;
              const isActive = regNode.status === 'active';

              if (isActive) {
                return (
                  <g>
                    <rect x={bx} y={by} width={72} height={22} rx={11} fill="#0f172a" stroke="#06b6d4" strokeWidth={1.5} />
                    <circle cx={bx + 14} cy={by + 11} r={6} fill="none" stroke="#06b6d4" strokeWidth={2}
                      strokeDasharray="14,14" strokeLinecap="round" className="nat-eval-spin" />
                    <text x={bx + 26} y={by + 15} style={{ fill: '#06b6d4', fontSize: '9px', fontWeight: 700, fontFamily: 'monospace' }}>
                      Testing…
                    </text>
                  </g>
                );
              }

              return (
                <g>
                  <rect x={bx} y={by} width={62} height={22} rx={11} fill="#0f172a" stroke="#10b981" strokeWidth={1.5} />
                  <text x={bx + 15} y={by + 15} style={{ fill: '#10b981', fontSize: '10px', fontWeight: 800 }}>✓</text>
                  <text x={bx + 26} y={by + 15} style={{ fill: '#10b981', fontSize: '9px', fontWeight: 700, fontFamily: 'monospace' }}>
                    12/12
                  </text>
                </g>
              );
            })()}

            {/* §8.4 SSO/Auth lock overlay on platform nodes */}
            {(() => {
              if (!events || !currentStep) return null;
              const currentEvents = events.slice(0, currentStep);
              const authEvent = currentEvents.find(e =>
                (e.status === 'running') &&
                (e.message.toLowerCase().includes('step-up auth') || e.message.toLowerCase().includes('auth required'))
              );
              if (!authEvent) return null;

              const isStillAuth = (() => {
                const authIdx = events.indexOf(authEvent);
                const laterEvents = events.slice(authIdx + 1, currentStep);
                return !laterEvents.some(e => e.nodeIds.some(nid => authEvent.nodeIds.includes(nid)) && e.status !== 'running');
              })();
              if (!isStillAuth) return null;

              return authEvent.nodeIds.map(nid => {
                const node = nodeMap.get(nid);
                if (!node) return null;
                return (
                  <g key={`auth-${nid}`}>
                    <rect x={node.x - 3} y={node.y - 3} width={nodeWidth + 6} height={nodeHeight + 6} rx={18}
                      fill="none" stroke="#f59e0b" strokeWidth={2.5} opacity={0.8} className="animate-pulse" />
                    <rect x={node.x + nodeWidth - 12} y={node.y - 10} width={24} height={24} rx={12}
                      fill="#0f172a" stroke="#f59e0b" strokeWidth={1.5} />
                    <foreignObject x={node.x + nodeWidth - 8} y={node.y - 6} width={16} height={16}>
                      <Lock className="w-4 h-4 text-amber-400 auth-lock-pulse" />
                    </foreignObject>
                  </g>
                );
              });
            })()}

            {/* §8.6 A2A Handshake Animation */}
            {(() => {
              const a2aNode = nodeMap.get('a2a-delegate');
              const reactNode = nodeMap.get('react-agent');
              if (!a2aNode || !reactNode) return null;

              const domainIds = ['domain-it', 'domain-hr', 'domain-finance', 'domain-vendor', 'domain-identity'];

              // Show A2A animation when a2a is active, OR when it's completed but a domain agent is still active
              const anyDomainActive = domainIds.some(id => {
                const n = nodeMap.get(id);
                return n && (n.status === 'active' || n.status === 'chosen');
              });
              const showA2A = a2aNode.status === 'active' || (a2aNode.status === 'completed' && anyDomainActive);
              if (!showA2A) return null;

              const a2aCX = a2aNode.x + nodeWidth / 2;
              const a2aCY = a2aNode.y + nodeHeight / 2;

              // Find the intent label from events
              let intentLabel = '';
              if (events && currentStep) {
                const delegationEvt = events.slice(0, currentStep).find(e =>
                  e.message.includes('Delegating') && e.nodeIds.includes('a2a-delegate')
                );
                if (delegationEvt) {
                  const domainMatch = delegationEvt.message.match(/domain-(\w+)/);
                  if (domainMatch) {
                    intentLabel = domainMatch[1].toUpperCase();
                  }
                }
              }

              return (
                <g>
                  {/* 1. Packet traveling react-agent → a2a-delegate */}
                  {(() => {
                    const rCX = reactNode.x + nodeWidth / 2;
                    const rCY = reactNode.y + nodeHeight / 2;
                    return (
                      <>
                        {/* Soft outer halo */}
                        <circle cx={0} cy={0} r={16} fill="rgba(168,85,247,0.12)">
                          <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={`M ${rCX} ${rCY} L ${a2aCX} ${a2aCY}`}
                          />
                        </circle>
                        {/* Mid glow ring */}
                        <circle cx={0} cy={0} r={10} fill="none" stroke="rgba(168,85,247,0.35)" strokeWidth={2}>
                          <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={`M ${rCX} ${rCY} L ${a2aCX} ${a2aCY}`}
                          />
                        </circle>
                        {/* Core dot with radial gradient look */}
                        <circle cx={0} cy={0} r={6} fill="url(#packetGradient)" style={{ filter: 'drop-shadow(0 0 8px #a855f7) drop-shadow(0 0 3px #c084fc)' }}>
                          <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={`M ${rCX} ${rCY} L ${a2aCX} ${a2aCY}`}
                          />
                        </circle>
                      </>
                    );
                  })()}

                  {/* 2. Fan-out scan lines to all domain agents */}
                  {domainIds.map((did) => {
                    const domNode = nodeMap.get(did);
                    if (!domNode) return null;

                    const dCX = domNode.x + nodeWidth / 2;
                    const dCY = domNode.y + nodeHeight / 2;

                    const isChosen = domNode.status === 'active' || domNode.status === 'completed' || domNode.status === 'chosen';

                    // Skip chosen ones — they already have styled connections
                    if (isChosen) return null;

                    return (
                      <line
                        key={`scan-${did}`}
                        x1={a2aCX}
                        y1={a2aCY}
                        x2={dCX}
                        y2={dCY}
                        stroke="#64748b"
                        strokeWidth={1}
                        strokeDasharray="6,4"
                        className="a2a-scan-line"
                        opacity={0.4}
                      />
                    );
                  })}

                  {/* 3. Intent delegation label — to the left of the chosen domain node, clear of arrows */}
                  {intentLabel && (() => {
                    const chosenDomain = domainIds
                      .map(id => nodeMap.get(id))
                      .find(n => n && (n.status === 'active' || n.status === 'completed' || n.status === 'chosen'));
                    if (!chosenDomain) return null;

                    const labelText = `Delegating: ${intentLabel}`;
                    const labelWidth = labelText.length * 6 + 16;
                    const labelHeight = 18;
                    // Above the chosen node, centered horizontally with it
                    const labelX = chosenDomain.x + nodeWidth / 2;
                    const labelY = chosenDomain.y - 20;

                    return (
                      <g>
                        <rect
                          x={labelX - labelWidth / 2}
                          y={labelY - labelHeight / 2}
                          width={labelWidth}
                          height={labelHeight}
                          rx={9}
                          fill="#1e1b4b"
                          stroke="#7c3aed"
                          strokeWidth={1}
                          opacity={0.95}
                        />
                        <text
                          x={labelX}
                          y={labelY + 3}
                          textAnchor="middle"
                          style={{ fill: '#c4b5fd', fontSize: '8px', fontWeight: 700, fontFamily: 'monospace' }}
                        >
                          {labelText}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })()}
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
