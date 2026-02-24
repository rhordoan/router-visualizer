import type { IceChatTraceSnapshot } from './iceChatTraceTypes';

export class IceChatTraceService {
  private baseUrl: string;
  private pollingInterval: number = 1000;
  private intervalId: number | null = null;
  private lastRunId: string | null = null;
  // Stored as instance props so the poll closure always calls the latest engine callback,
  // even when startPolling is called again after a hot-reload or engine recreation.
  private _onNewSnapshot: ((snapshot: IceChatTraceSnapshot, isNew: boolean) => void) | null = null;
  private _onError: ((error: unknown) => void) | null = null;

  constructor(baseUrl: string = '/api/ice-chat') {
    this.baseUrl = baseUrl;
  }

  async fetchLatest(): Promise<IceChatTraceSnapshot | null> {
    try {
      const response = await fetch(`${this.baseUrl}/latest`, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) return null;
        return null;
      }
      const data = (await response.json()) as IceChatTraceSnapshot | null;
      return data;
    } catch {
      return null;
    }
  }

  startPolling(
    onNewSnapshot: (snapshot: IceChatTraceSnapshot, isNew: boolean) => void,
    onError?: (error: unknown) => void
  ) {
    // Always update the callbacks so a new engine created after a hot-reload
    // or scenario remount gets its snapshots even if polling was already running.
    this._onNewSnapshot = onNewSnapshot;
    this._onError = onError ?? null;

    if (this.intervalId !== null) return; // Already polling — callback updated above, nothing else to do

    const poll = async () => {
      try {
        const snapshot = await this.fetchLatest();
        if (!snapshot) return;
        const isNew = snapshot.run_id !== this.lastRunId;
        if (isNew) this.lastRunId = snapshot.run_id;
        this._onNewSnapshot?.(snapshot, isNew);
      } catch (error) {
        this._onError?.(error);
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
    // Clear callbacks so the detached engine can be garbage-collected.
    this._onNewSnapshot = null;
    this._onError = null;
  }

  isPolling(): boolean {
    return this.intervalId !== null;
  }
}

export const iceChatTraceService = new IceChatTraceService();
