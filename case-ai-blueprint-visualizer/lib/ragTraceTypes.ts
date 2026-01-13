export type RAGTraceStepStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface RAGTraceStep {
  id: string;
  step_type: string;
  label: string;
  status: RAGTraceStepStatus;
  timestamp: string;
  duration_ms: number | null;
  description: string | null;
  metadata: Record<string, unknown>;
}

export interface RAGRetrievalResult {
  document_id: string;
  score: number;
  content_preview: string;
  source: string;
}

export interface RAGGuardrailsResult {
  passed: boolean;
  violations: string[];
  action_taken: string | null;
}

export interface RAGMetrics {
  total_latency_ms: number;
  embedding_time_ms: number | null;
  retrieval_time_ms: number | null;
  reranking_time_ms: number | null;
  generation_time_ms: number | null;
  guardrails_input_time_ms: number | null;
  guardrails_output_time_ms: number | null;
  documents_retrieved: number;
  documents_reranked: number;
  final_context_tokens: number | null;
}

export interface RAGTraceSnapshot {
  run_id: string;
  user_query: string | null;
  embedding_model: string | null;
  retrieval_strategy: string | null;
  generation_model: string | null;
  retrieved_documents: RAGRetrievalResult[];
  guardrails_input: RAGGuardrailsResult | null;
  guardrails_output: RAGGuardrailsResult | null;
  final_response: string | null;
  steps: RAGTraceStep[];
  metrics: RAGMetrics;
  created_at: string;
  last_updated: string;
  error: string | null;
}
