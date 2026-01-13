import type { RAGTraceSnapshot } from './ragTraceTypes';

export class RAGTraceService {
  private baseUrl: string;
  private pollingInterval: number = 1000;
  private intervalId: number | null = null;
  private lastRunId: string | null = null;

  constructor(baseUrl: string = '/api/rag') {
    this.baseUrl = baseUrl;
  }

  async fetchLatest(): Promise<RAGTraceSnapshot | null> {
    try {
      const response = await fetch(`${this.baseUrl}/latest`, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) return null;
        return null;
      }
      const data = (await response.json()) as RAGTraceSnapshot | null;
      return data;
    } catch {
      return null;
    }
  }

  startPolling(
    onNewSnapshot: (snapshot: RAGTraceSnapshot, isNew: boolean) => void,
    onError?: (error: unknown) => void
  ) {
    if (this.intervalId !== null) return;

    const poll = async () => {
      try {
        const snapshot = await this.fetchLatest();
        if (!snapshot) return;
        const isNew = snapshot.run_id !== this.lastRunId;
        if (isNew) this.lastRunId = snapshot.run_id;
        onNewSnapshot(snapshot, isNew);
      } catch (error) {
        if (onError) onError(error);
      }
    };

    poll();
    this.intervalId = window.setInterval(poll, this.pollingInterval);
  }

  stopPolling() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isPolling(): boolean {
    return this.intervalId !== null;
  }
}

export const ragTraceService = new RAGTraceService();
