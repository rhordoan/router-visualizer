export type NodeStatus = 'active' | 'completed' | 'upcoming' | 'chosen' | 'dormant' | 'skipped' | 'error';

export interface BlueprintNode {
  id: string;
  label: string;
  type: 'intake' | 'process' | 'classify' | 'route' | 'model' | 'execute' | 'validate' | 'output' | 'retrieval' | 'assembly'
  | 'orchestrator' | 'domain_agent' | 'platform' | 'native_agent' | 'api_call' | 'approval' | 'vectordb' | 'llm' | 'embedder' | 'nim' | 'registry' | 'config' | 'observability' | 'helpbot';
  icon: string;
  x: number;
  y: number;
  layer?: number;
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

// §8.2 NeMo Profiler flame chart span
export interface ProfilerSpan {
  label: string;
  duration: number;   // ms
  widthPct: number;   // 0-100
  depth: number;      // indentation level
  color: string;      // Tailwind bg class
}

// §6 Connector Registry card
export interface ConnectorTool {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  callsToday: number;
  errorCount: number;
  requiresConfirmation: boolean;
}

export interface ConnectorCard {
  id: string;
  name: string;
  platform: string;
  icon: string;
  version: string;
  domain: string;
  capability: 'full' | 'read-only' | 'write-only' | 'partial';
  status: 'healthy' | 'degraded' | 'offline';
  intents: string[];
  tools: ConnectorTool[];
  runtime: {
    invoke: string;
    delegateAgent?: string;
  };
  mcpMapping: {
    toolName: string;
    resourceUri: string;
  };
  lastUsed: string;
  callsToday: number;
}

// §7 Onboarding Pipeline
export interface OnboardingStep {
  id: string;
  label: string;
  icon: string;
  description: string;
  status: NodeStatus;
}

// §8.5 Payload Inspector
export interface PayloadInspection {
  nodeId: string;
  toolName: string;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  schema: Record<string, unknown>;
  mcpTool?: string;
  mcpResource?: string;
}

