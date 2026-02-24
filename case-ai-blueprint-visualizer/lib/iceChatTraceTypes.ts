export interface IceChatTraceStep {
  id: string;
  step_type: string;
  label: string;
  /** Pre-computed blueprint node IDs that this step activates */
  node_ids: string[];
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: string;
  duration_ms: number | null;
  description: string | null;
  /** Original ICE-chat tool name (for tool-call steps) */
  tool?: string;
  /** System of record: "ServiceNow" | "Jira" | "Microsoft Graph" | "Internal IT Docs" */
  system?: string;
  /** Actual tool call arguments (from agent_service tool_trace) */
  args?: Record<string, unknown>;
  /** Actual tool result data or error string */
  result?: unknown;
  /** Tool input JSON Schema from the registry contract */
  schema?: Record<string, unknown>;
}

export interface IceChatTraceSnapshot {
  run_id: string;
  user_query: string | null;
  assistant_response: string | null;
  steps: IceChatTraceStep[];
  created_at: string;
  last_updated: string;
  error: string | null;
}
