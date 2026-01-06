export type NodeStatus = 'active' | 'completed' | 'upcoming' | 'chosen' | 'dormant' | 'skipped' | 'error';

export interface BlueprintNode {
  id: string;
  label: string;
  type: 'intake' | 'process' | 'classify' | 'route' | 'model' | 'execute' | 'validate' | 'output' | 'retrieval' | 'assembly';
  icon: string;
  x: number;
  y: number;
  status: NodeStatus;
  description?: string;
}

export interface Connection {
  from: string;
  to: string;
  active?: boolean;
}

export interface EventStep {
  id: string;
  message: string;
  timing: number;
  status: 'completed' | 'running' | 'pending' | 'skipped' | 'error';
  nodeIds: string[];
}

export interface ChatMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
  timing: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  query: string;
  events: EventStep[];
  chatMessages: ChatMessage[];
  activeNodes: string[];
  chosenPath?: string[];
}

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  nodes: BlueprintNode[];
  connections: Connection[];
  scenarios: Scenario[];
}

