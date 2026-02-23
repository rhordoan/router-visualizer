import type { Blueprint, Scenario, EventStep, NodeStatus } from './types';
import type { AnimationState } from './animationEngine';
import type { IceChatTraceService } from './iceChatTraceService';
import type { IceChatTraceSnapshot } from './iceChatTraceTypes';

const parseIsoMs = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export class IceChatAnimationEngine {
  private state: AnimationState;
  private blueprint: Blueprint;
  private scenario: Scenario;
  private onStateChange: (state: AnimationState) => void;
  private traceService: IceChatTraceService;
  private lastRunId: string | null = null;

  constructor(
    blueprint: Blueprint,
    scenario: Scenario,
    onStateChange: (state: AnimationState) => void,
    traceService: IceChatTraceService
  ) {
    this.blueprint = blueprint;
    this.scenario = scenario;
    this.onStateChange = onStateChange;
    this.traceService = traceService;
    this.state = this.getInitialState();
  }

  private getInitialState(): AnimationState {
    return {
      currentStep: 0,
      isPlaying: false,
      speed: 1,
      nodes: this.blueprint.nodes.map((node) => ({ ...node, status: 'dormant' as NodeStatus })),
      completedEvents: [],
      currentEvent: null,
    };
  }

  public start(): void {
    this.traceService.startPolling(
      (snapshot, isNew) => this.onNewSnapshot(snapshot, isNew),
      (error) => console.error('ICE-chat trace polling error:', error)
    );
  }

  public stop(): void {
    this.traceService.stopPolling();
  }

  private onNewSnapshot(snapshot: IceChatTraceSnapshot, isNew: boolean): void {
    const isActuallyNew = isNew || (this.lastRunId !== null && snapshot.run_id !== this.lastRunId);

    if (isActuallyNew) {
      this.lastRunId = snapshot.run_id;
      this.state = this.getInitialState();
    } else if (this.lastRunId === null) {
      this.lastRunId = snapshot.run_id;
    }

    this.updateScenarioFromSnapshot(snapshot);
    this.updateStateFromSnapshot(snapshot);
    this.notifyStateChange();
  }

  private updateScenarioFromSnapshot(snapshot: IceChatTraceSnapshot): void {
    this.scenario.query = snapshot.user_query || 'Waiting for query…';

    const createdAtMs = parseIsoMs(snapshot.created_at);

    // Build events from steps
    this.scenario.events = snapshot.steps.map((step): EventStep => {
      const timing = Math.max(0, parseIsoMs(step.timestamp) - createdAtMs);
      const status: EventStep['status'] =
        step.status === 'running' ? 'running'
        : step.status === 'completed' ? 'completed'
        : step.status === 'error' ? 'error'
        : 'pending';

      return {
        id: step.id,
        message: step.description ? `${step.label} — ${step.description}` : step.label,
        timing,
        status,
        nodeIds: step.node_ids,
      };
    });

    // Build chat messages
    this.scenario.chatMessages = [];

    if (snapshot.user_query) {
      this.scenario.chatMessages.push({ role: 'user', content: snapshot.user_query, timing: 0 });
    } else {
      this.scenario.chatMessages.push({ role: 'system', content: 'Waiting for query…', timing: 0 });
    }

    for (const step of snapshot.steps) {
      const timing = Math.max(0, parseIsoMs(step.timestamp) - createdAtMs);
      const suffix =
        step.status === 'running' ? ' ⏳'
        : step.status === 'error' ? ' ❌'
        : step.status === 'completed' ? ' ✓'
        : '';
      this.scenario.chatMessages.push({
        role: 'system',
        content: `${step.label}${suffix}`,
        timing,
      });
    }

    if (snapshot.assistant_response) {
      const timing = Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs);
      this.scenario.chatMessages = this.scenario.chatMessages.filter((m) => m.role !== 'assistant');
      this.scenario.chatMessages.push({ role: 'assistant', content: snapshot.assistant_response, timing });
    } else if (snapshot.error) {
      const timing = Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs);
      this.scenario.chatMessages = this.scenario.chatMessages.filter((m) => m.role !== 'assistant');
      this.scenario.chatMessages.push({ role: 'assistant', content: `❌ ${snapshot.error}`, timing });
    }

    // Derive activeNodes from all node_ids referenced in steps
    const allNodeIds = new Set<string>();
    for (const step of snapshot.steps) {
      step.node_ids.forEach((id) => allNodeIds.add(id));
    }
    this.scenario.activeNodes = Array.from(allNodeIds);
    this.scenario.chosenPath = ['domain-it'];
  }

  private updateStateFromSnapshot(snapshot: IceChatTraceSnapshot): void {
    // Show all events
    this.state.currentStep = this.scenario.events.length;
    this.state.completedEvents = this.scenario.events
      .filter((e) => e.status === 'completed')
      .map((e) => e.id);

    const upcoming = new Set(this.scenario.activeNodes);

    // Reset node statuses
    this.state.nodes = this.state.nodes.map((n) => ({
      ...n,
      status: (upcoming.has(n.id) ? 'upcoming' : 'dormant') as NodeStatus,
    }));

    // Apply statuses from events
    for (const event of this.scenario.events) {
      for (const nodeId of event.nodeIds) {
        const node = this.state.nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        if (event.status === 'running') node.status = 'active';
        else if (event.status === 'completed') node.status = 'completed';
        else if (event.status === 'error') node.status = 'error';
      }
    }

    if (this.scenario.events.length > 0) {
      this.state.currentEvent = this.scenario.events[this.scenario.events.length - 1];
    }

    // Snapshot-level error: mark all running nodes as error
    if (snapshot.error) {
      this.state.nodes = this.state.nodes.map((n) =>
        n.status === 'active' ? { ...n, status: 'error' as NodeStatus } : n
      );
    }
  }

  private notifyStateChange(): void {
    this.onStateChange({ ...this.state });
  }

  public getState(): AnimationState {
    return { ...this.state };
  }

  public reset(): void {
    this.lastRunId = null;
    this.state = this.getInitialState();
    this.notifyStateChange();
  }

  // No-ops — real-time mode only
  public play(): void { /* no-op */ }
  public pause(): void { /* no-op */ }
  public next(): void { /* no-op */ }
  public setSpeed(_speed?: number): void { /* no-op */ }
}
