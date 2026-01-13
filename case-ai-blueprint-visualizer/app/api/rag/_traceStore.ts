import type { RAGTraceSnapshot } from '@/lib/ragTraceTypes';

// Simple in-memory store for the most recent RAG run.
// Note: in serverless/multi-instance deployments this won't be shared across instances.
let latest: RAGTraceSnapshot | null = null;

export function getLatestRAGTrace(): RAGTraceSnapshot | null {
  return latest;
}

export function setLatestRAGTrace(snapshot: RAGTraceSnapshot | null) {
  latest = snapshot;
}
