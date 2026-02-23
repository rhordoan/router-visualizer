import type { IceChatTraceSnapshot } from '@/lib/iceChatTraceTypes';

// Simple in-memory store for the most recent ICE-chat run.
// Note: in serverless/multi-instance deployments this won't be shared across instances.
let latest: IceChatTraceSnapshot | null = null;

export function getLatestIceChatTrace(): IceChatTraceSnapshot | null {
  return latest;
}

export function setLatestIceChatTrace(snapshot: IceChatTraceSnapshot | null) {
  latest = snapshot;
}
