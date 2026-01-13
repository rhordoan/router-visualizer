import { Blueprint, Scenario, EventStep, NodeStatus } from './types';
import { AnimationState } from './animationEngine';
import { RAGTraceService } from './ragTraceService';
import type { RAGTraceSnapshot } from './ragTraceTypes';

const mapStepTypeToNodeId = (stepType: string): string | null => {
  const mapping: Record<string, string> = {
    intake: 'intake',
    embedding: 'embedding',
    retrieval: 'retrieval',
    reranking: 'reranking',
    context_assembly: 'context_assembly',
    guardrails_input: 'guardrails_input',
    generation: 'generation',
    guardrails_output: 'guardrails_output',
    output: 'output',
  };
  return mapping[stepType] || null;
};

const parseIsoMs = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export class RAGAnimationEngine {
  private state: AnimationState;
  private blueprint: Blueprint;
  private scenario: Scenario;
  private onStateChange: (state: AnimationState) => void;
  private traceService: RAGTraceService;
  private lastRunId: string | null = null;
  private currentSnapshot: RAGTraceSnapshot | null = null;

  constructor(
    blueprint: Blueprint,
    scenario: Scenario,
    onStateChange: (state: AnimationState) => void,
    traceService: RAGTraceService
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
      (error) => console.error('RAG trace polling error:', error)
    );
  }

  public stop(): void {
    this.traceService.stopPolling();
  }

  private onNewSnapshot(snapshot: RAGTraceSnapshot, isNew: boolean): void {
    const isActuallyNew = isNew || (this.lastRunId !== null && snapshot.run_id !== this.lastRunId);
    this.currentSnapshot = snapshot;

    if (isActuallyNew) {
      this.lastRunId = snapshot.run_id;
      this.state = this.getInitialState();
    } else if (this.lastRunId === null) {
      this.lastRunId = snapshot.run_id;
    }

    this.updateScenarioFromSnapshot(snapshot);
    this.updateStateFromScenario(snapshot);
    this.notifyStateChange();
  }

  private updateScenarioFromSnapshot(snapshot: RAGTraceSnapshot): void {
    this.scenario.query = snapshot.user_query || 'Waiting for RAG query...';

    this.scenario.events = this.convertStepsToEvents(snapshot);

    const createdAtMs = parseIsoMs(snapshot.created_at);

    this.scenario.chatMessages = [];
    if (snapshot.user_query) {
      this.scenario.chatMessages.push({ role: 'user', content: snapshot.user_query, timing: 0 });
    } else {
      this.scenario.chatMessages.push({ role: 'system', content: 'Waiting for RAG query...', timing: 0 });
    }

    // System progress messages for each step
    snapshot.steps.forEach((step) => {
      const timing = Math.max(0, parseIsoMs(step.timestamp) - createdAtMs);
      const details = step.description ? `\n${step.description}` : '';
      const suffix =
        step.status === 'running'
          ? '\n⏳ running'
          : step.status === 'error'
          ? '\n❌ error'
          : step.status === 'completed'
          ? '\n✓ completed'
          : '';
      this.scenario.chatMessages.push({
        role: 'system',
        content: `${step.label}${details}${suffix}`,
        timing,
      });
    });

    // Add metrics info
    if (snapshot.metrics.documents_retrieved > 0) {
      this.scenario.chatMessages.push({
        role: 'system',
        content: `📚 Retrieved ${snapshot.metrics.documents_retrieved} documents (${snapshot.metrics.retrieval_time_ms}ms)`,
        timing: Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs),
      });
    }

    // Add guardrails results
    if (snapshot.guardrails_input) {
      const status = snapshot.guardrails_input.passed ? '✓ Passed' : '❌ Failed';
      const violations = snapshot.guardrails_input.violations.length > 0 
        ? ` (${snapshot.guardrails_input.violations.join(', ')})` 
        : '';
      this.scenario.chatMessages.push({
        role: 'system',
        content: `🛡️ Input Guardrails: ${status}${violations}`,
        timing: Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs),
      });
    }

    if (snapshot.guardrails_output) {
      const status = snapshot.guardrails_output.passed ? '✓ Passed' : '❌ Failed';
      const violations = snapshot.guardrails_output.violations.length > 0 
        ? ` (${snapshot.guardrails_output.violations.join(', ')})` 
        : '';
      this.scenario.chatMessages.push({
        role: 'system',
        content: `🛡️ Output Guardrails: ${status}${violations}`,
        timing: Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs),
      });
    }

    // Add final response
    if (snapshot.final_response) {
      const timing = Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs);
      this.scenario.chatMessages = this.scenario.chatMessages.filter((m) => m.role !== 'assistant');
      this.scenario.chatMessages.push({ role: 'assistant', content: snapshot.final_response, timing });
    } else if (snapshot.error) {
      this.scenario.chatMessages = this.scenario.chatMessages.filter((m) => m.role !== 'assistant');
      this.scenario.chatMessages.push({
        role: 'assistant',
        content: `❌ ${snapshot.error}`,
        timing: Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs),
      });
    }

    // All RAG nodes are active
    this.scenario.activeNodes = [
      'intake',
      'embedding',
      'retrieval',
      'reranking',
      'context_assembly',
      'guardrails_input',
      'generation',
      'guardrails_output',
      'output',
    ];
  }

  private convertStepsToEvents(snapshot: RAGTraceSnapshot): EventStep[] {
    const createdAtMs = parseIsoMs(snapshot.created_at);
    const events: EventStep[] = [];

    const sorted = [...snapshot.steps].sort((a, b) => parseIsoMs(a.timestamp) - parseIsoMs(b.timestamp));

    for (const step of sorted) {
      const nodeId = mapStepTypeToNodeId(step.step_type);
      const timing = Math.max(0, parseIsoMs(step.timestamp) - createdAtMs);
      const status: EventStep['status'] =
        step.status === 'running'
          ? 'running'
          : step.status === 'completed'
          ? 'completed'
          : step.status === 'error'
          ? 'error'
          : step.status === 'skipped'
          ? 'skipped'
          : 'pending';

      events.push({
        id: step.id,
        message: step.description ? `${step.label} - ${step.description}` : step.label,
        timing,
        status,
        nodeIds: nodeId ? [nodeId] : [],
      });
    }

    return events;
  }

  private updateStateFromScenario(snapshot: RAGTraceSnapshot): void {
    const nodes = [...this.state.nodes];
    const events = this.scenario.events;

    // Reset all nodes to dormant first
    nodes.forEach((node) => {
      node.status = 'dormant';
    });

    // Update node statuses based on trace steps
    for (const step of snapshot.steps) {
      const nodeId = mapStepTypeToNodeId(step.step_type);
      if (!nodeId) continue;

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      if (step.status === 'completed') {
        node.status = 'completed';
      } else if (step.status === 'running') {
        node.status = 'active';
      } else if (step.status === 'error') {
        node.status = 'error';
      } else if (step.status === 'skipped') {
        node.status = 'skipped';
      } else if (step.status === 'pending') {
        node.status = 'upcoming';
      }
    }

    // Determine which events are "completed" based on time
    const nowMs = Date.now();
    const createdAtMs = parseIsoMs(snapshot.created_at);
    const elapsedMs = nowMs - createdAtMs;

    const completedEvents: string[] = [];
    let currentEvent: EventStep | null = null;

    for (const event of events) {
      if (event.timing < elapsedMs) {
        if (event.status === 'completed' || event.status === 'error' || event.status === 'skipped') {
          completedEvents.push(event.id);
        } else {
          currentEvent = event;
        }
      }
    }

    this.state = {
      ...this.state,
      nodes,
      completedEvents,
      currentEvent,
      currentStep: completedEvents.length,
      isPlaying: true,
    };
  }

  private notifyStateChange(): void {
    this.onStateChange(this.state);
  }

  public getState(): AnimationState {
    return this.state;
  }

  public getCurrentSnapshot(): RAGTraceSnapshot | null {
    return this.currentSnapshot;
  }

  public pause(): void {
    this.state = { ...this.state, isPlaying: false };
    this.notifyStateChange();
  }

  public play(): void {
    this.state = { ...this.state, isPlaying: true };
    this.notifyStateChange();
  }
}
