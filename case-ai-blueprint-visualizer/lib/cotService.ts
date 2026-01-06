export interface CoTStep {
  id: string;
  step_type: string;
  label: string;
  description: string | null;
  status: string;
  timestamp: string;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface MessageCoTSnapshot {
  message_id: number;
  conversation_id: number;
  session_id: string;
  user_query: string;
  assistant_response: string | null;
  cot_steps: CoTStep[];
  sources_count: number;
  suggestions_count: number;
  total_steps: number;
  completed_steps: number;
  active_step: string | null;
  created_at: string;
  last_updated: string;
  processing_time_ms: number | null;
}

export class HealthChatCoTService {
  private baseUrl: string;
  private pollingInterval: number = 1000; // 1s
  private intervalId: number | null = null;
  private lastMessageId: number | null = null;
  
  constructor(baseUrl: string = '/api/cot') {
    // Use local proxy endpoint by default (blueprint visualizer API route)
    // This proxies to HealthChat backend at http://localhost:8000
    this.baseUrl = baseUrl;
  }

  async fetchLatest(): Promise<MessageCoTSnapshot | null> {
    try {
      // Call local proxy endpoint (no auth needed on client - handled server-side)
      const response = await fetch(`${this.baseUrl}/latest`, {
        cache: 'no-store', // Disable caching for real-time data
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error('❌ Unauthorized. Check HEALTHCHAT_AUTH_TOKEN in .env.local');
        } else if (response.status === 404) {
          // No messages yet
        } else {
          console.error(`❌ API error: ${response.status}`);
        }
        return null;
      }

      const data = await response.json();
      
      // Handle null response (no messages)
      if (!data) {
        return null;
      }
      
      // Parse and enhance the data if needed
      if (data && data.cot_steps) {
        data.cot_steps = this.parseCoTSteps(data.cot_steps);
      }
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching CoT latest:', error);
      return null;
    }
  }

  /**
   * Parse CoT steps - handle both structured and text-based formats
   */
  private parseCoTSteps(steps: unknown[]): CoTStep[] {
    if (!Array.isArray(steps)) return [];

    return steps.map((stepData: unknown, index) => {
      const step = stepData as Record<string, unknown>;
      
      // If step is already properly structured
      if (step.step_type && step.label && step.id && step.status && step.timestamp) {
        return step as unknown as CoTStep;
      }

      // If step is text-based, parse it
      let stepType = 'unknown';
      const label = (step.label || step.step || 'Processing') as string;
      const description = (step.description || step.details || null) as string | null;
      let durationMs = (step.duration_ms || null) as number | null;

      // Try to extract timing from description
      if (description && typeof description === 'string') {
        const timingMatch = description.match(/(\d+(?:\.\d+)?)\s*ms/);
        if (timingMatch && !durationMs) {
          durationMs = parseFloat(timingMatch[1]);
        }
      }

      // Map label to step_type
      const labelLower = label.toLowerCase();
      if (labelLower.includes('analyzing') || labelLower.includes('evaluating')) {
        stepType = 'analyzing';
      } else if (labelLower.includes('augment') || labelLower.includes('enhanc')) {
        stepType = 'augmenting';
      } else if (labelLower.includes('search') && labelLower.includes('vector')) {
        stepType = 'searching';
      } else if (labelLower.includes('retrieved') || labelLower.includes('found')) {
        stepType = 'retrieved';
      } else if (labelLower.includes('retriev')) {
        stepType = 'retrieving';
      } else if (labelLower.includes('web')) {
        stepType = 'web_search';
      } else if (labelLower.includes('document')) {
        stepType = 'analyzing_document';
      } else if (labelLower.includes('generat') || labelLower.includes('processing')) {
        stepType = 'generating';
      } else if (labelLower.includes('suggest')) {
        stepType = 'suggestions';
      }

      return {
        id: (step.id as string) || `step-${index}`,
        step_type: stepType,
        label,
        description,
        status: (step.status as string) || 'complete',
        timestamp: (step.timestamp as string) || new Date().toISOString(),
        duration_ms: durationMs,
        metadata: (step.metadata as Record<string, unknown>) || {},
      } as CoTStep;
    });
  }

  async fetchFeed(): Promise<MessageCoTSnapshot | null> {
    try {
      // Note: Feed endpoint not implemented in proxy yet
      // This would require adding /api/cot/feed/route.ts
      console.warn('fetchFeed not implemented in proxy. Use fetchLatest() instead.');
      return null;
    } catch (error) {
      console.error('❌ Error fetching CoT feed:', error);
      return null;
    }
  }

  startPolling(
    onNewMessage: (snapshot: MessageCoTSnapshot, isNew: boolean) => void,
    onError?: (error: unknown) => void
  ): void {
    if (this.intervalId !== null) {
      console.warn('Polling already started');
      return;
    }

    const poll = async () => {
      try {
        // Use /latest for fastest real-time updates
        const snapshot = await this.fetchLatest();
        
        if (!snapshot) {
          return;
        }

        // Detect new message
        const isNewMessage = snapshot.message_id !== this.lastMessageId;
        
        if (isNewMessage) {
          this.lastMessageId = snapshot.message_id;
        }

        // Always callback with latest data and isNew flag
        onNewMessage(snapshot, isNewMessage);
        
      } catch (error) {
        console.error('Polling error:', error);
        if (onError) {
          onError(error);
        }
      }
    };

    // Initial poll
    poll();

    // Start interval - poll every 1 second for real-time updates
    this.intervalId = window.setInterval(poll, this.pollingInterval);
  }

  stopPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setPollingInterval(ms: number): void {
    this.pollingInterval = ms;
    
    // Restart polling if active
    if (this.intervalId !== null) {
      this.stopPolling();
      // Note: Need to restart with same callback, would need refactor
      console.warn('Polling interval changed. Restart polling manually.');
    }
  }

  isPolling(): boolean {
    return this.intervalId !== null;
  }
}

// Singleton instance
export const cotService = new HealthChatCoTService();
