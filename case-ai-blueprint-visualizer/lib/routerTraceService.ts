import type { RouterTraceSnapshot } from './routerTraceTypes';

export class RouterTraceService {
  private baseUrl: string;
  private pollingInterval: number = 1000;
  private intervalId: number | null = null;
  private lastRunId: string | null = null;

  constructor(baseUrl: string = '/api/router') {
    this.baseUrl = baseUrl;
  }

  async fetchLatest(): Promise<RouterTraceSnapshot | null> {
    try {
      const response = await fetch(`${this.baseUrl}/latest`, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) return null;
        return null;
      }
      const data = (await response.json()) as RouterTraceSnapshot | null;
      return data;
    } catch {
      return null;
    }
  }

  startPolling(
    onNewSnapshot: (snapshot: RouterTraceSnapshot, isNew: boolean) => void,
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

export const routerTraceService = new RouterTraceService();




