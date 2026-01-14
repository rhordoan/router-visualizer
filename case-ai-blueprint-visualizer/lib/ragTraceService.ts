import type { RAGTraceSnapshot } from './ragTraceTypes';

export class RAGTraceService {
  private baseUrl: string;
  private pollingInterval: number = 1000;
  private intervalId: number | null = null;
  private lastRunId: string | null = null;
  private eventSource: EventSource | null = null;
  private isStreaming: boolean = false;

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
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isStreaming = false;
    }
  }

  isPolling(): boolean {
    return this.intervalId !== null || this.isStreaming;
  }

  /**
   * Start a new RAG query and stream updates in real-time via SSE
   */
  async startQuery(
    query: string,
    onNewSnapshot: (snapshot: RAGTraceSnapshot, isNew: boolean) => void,
    onError?: (error: unknown) => void
  ): Promise<void> {
    try {
      // Stop any existing polling/streaming
      this.stopPolling();

      // Start SSE stream by calling /api/rag/run
      const response = await fetch(`${this.baseUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start RAG query: ${response.status} ${response.statusText}`);
      }

      // Check if the response is SSE
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        // Start streaming - we'll poll the /latest endpoint to get updates
        // The backend is updating the trace store in real-time
        this.isStreaming = true;
        this.startPolling(onNewSnapshot, onError);

        // Also read the stream to keep it alive (though we're polling for data)
        this.readStream(response);
      } else {
        // Non-streaming response, just poll
        this.startPolling(onNewSnapshot, onError);
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }

  private async readStream(response: Response) {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this.isStreaming = false;
          break;
        }
        // Just consume the stream, the backend is updating the trace store
        decoder.decode(value, { stream: true });
      }
    } catch (error) {
      console.error('Stream reading error:', error);
      this.isStreaming = false;
    }
  }
}

export const ragTraceService = new RAGTraceService();
