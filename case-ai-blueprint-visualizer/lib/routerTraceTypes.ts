export type RouterTraceStepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface RouterTraceStep {
  id: string;
  step_type: string;
  label: string;
  status: RouterTraceStepStatus;
  timestamp: string;
  duration_ms: number | null;
  description: string | null;
  metadata: Record<string, unknown>;
}

export interface RouterTraceSnapshot {
  run_id: string;
  routing_strategy: string | null;
  user_query: string | null;
  selected_model: string | null;
  probabilities: Record<string, number> | null;
  steps: RouterTraceStep[];
  created_at: string;
  last_updated: string;
  error: string | null;
}



