import type { RouterTraceSnapshot } from '@/lib/routerTraceTypes';

// Simple in-memory store for the most recent run.
// Note: in serverless/multi-instance deployments this won't be shared across instances.
let latest: RouterTraceSnapshot | null = null;

export function getLatestRouterTrace(): RouterTraceSnapshot | null {
  return latest;
}

export function setLatestRouterTrace(snapshot: RouterTraceSnapshot | null) {
  latest = snapshot;
}


