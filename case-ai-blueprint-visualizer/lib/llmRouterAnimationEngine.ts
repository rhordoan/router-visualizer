import { Blueprint, Scenario, EventStep, NodeStatus } from './types';
import { AnimationState } from './animationEngine';
import { RouterTraceService } from './routerTraceService';
import type { RouterTraceSnapshot } from './routerTraceTypes';

const mapStepTypeToNodeId = (stepType: string): string | null => {
  const mapping: Record<string, string> = {
    intake: 'intake',
    preprocess: 'preprocess',
    classify: 'classify',
    route: 'route',
    execute: 'execute',
    validate: 'validate',
    output: 'output',
  };
  return mapping[stepType] || null;
};

const mapSelectedModelToNodeId = (selectedModel: string): string | null => {
  const m = selectedModel.toLowerCase();
  // Heuristic based on common model naming in llm-router configs/providers.
  // Examples:
  // - "meta/llama-3.1-70b-instruct" => large
  // - "meta/llama-3.1-8b-instruct" => small
  // - "mistralai/mixtral-8x22b-instruct-v0.1" => large
  if (m.includes('70b') || m.includes('22b') || m.includes('gpt')) return 'model-large';
  if (m.includes('8b') || m.includes('nemotron')) return 'model-small';
  if (m.includes('vl')) return 'model-medium';
  // fallback
  return 'model-medium';
};

const parseIsoMs = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export class LlmRouterAnimationEngine {
  private state: AnimationState;
  private blueprint: Blueprint;
  private scenario: Scenario;
  private onStateChange: (state: AnimationState) => void;
  private traceService: RouterTraceService;
  private lastRunId: string | null = null;
  private currentSnapshot: RouterTraceSnapshot | null = null;

  constructor(
    blueprint: Blueprint,
    scenario: Scenario,
    onStateChange: (state: AnimationState) => void,
    traceService: RouterTraceService
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
      (error) => console.error('Router trace polling error:', error)
    );
  }

  public stop(): void {
    this.traceService.stopPolling();
  }

  private onNewSnapshot(snapshot: RouterTraceSnapshot, isNew: boolean): void {
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

  private updateScenarioFromSnapshot(snapshot: RouterTraceSnapshot): void {
    this.scenario.query = snapshot.user_query || 'Waiting for request...';

    this.scenario.events = this.convertStepsToEvents(snapshot);

    const createdAtMs = parseIsoMs(snapshot.created_at);

    this.scenario.chatMessages = [];
    if (snapshot.user_query) {
      this.scenario.chatMessages.push({ role: 'user', content: snapshot.user_query, timing: 0 });
    } else {
      this.scenario.chatMessages.push({ role: 'system', content: 'Waiting for request...', timing: 0 });
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

    if (snapshot.selected_model) {
      this.scenario.chatMessages.push({
        role: 'system',
        content: `Selected model: ${snapshot.selected_model}`,
        timing: Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs),
      });
    }

    const output = snapshot.steps.find((s) => s.step_type === 'output');
    const assistantText =
      (output?.metadata?.assistant_response as string | undefined) ||
      (output?.metadata?.assistant_response_preview as string | undefined) ||
      null;
    if (assistantText) {
      const timing = Math.max(0, parseIsoMs(output?.timestamp || snapshot.last_updated) - createdAtMs);
      this.scenario.chatMessages = this.scenario.chatMessages.filter((m) => m.role !== 'assistant');
      this.scenario.chatMessages.push({ role: 'assistant', content: assistantText, timing });
    } else if (snapshot.error) {
      this.scenario.chatMessages = this.scenario.chatMessages.filter((m) => m.role !== 'assistant');
      this.scenario.chatMessages.push({
        role: 'assistant',
        content: `❌ ${snapshot.error}`,
        timing: Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs),
      });
    }

    // Ensure full node set is considered
    this.scenario.activeNodes = [
      'intake',
      'preprocess',
      'classify',
      'route',
      'model-small',
      'model-medium',
      'model-large',
      'execute',
      'validate',
      'output',
    ];
    this.scenario.chosenPath = snapshot.selected_model
      ? [mapSelectedModelToNodeId(snapshot.selected_model)].filter(Boolean) as string[]
      : [];
  }

  private convertStepsToEvents(snapshot: RouterTraceSnapshot): EventStep[] {
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
          : 'pending';

      events.push({
        id: step.id,
        message: step.description ? `${step.label} - ${step.description}` : step.label,
        timing,
        status,
        nodeIds: nodeId ? [nodeId] : [],
      });
    }

    // If model selected, add a synthetic event for chosen path
    if (snapshot.selected_model) {
      const chosenNode = mapSelectedModelToNodeId(snapshot.selected_model);
      if (chosenNode) {
        events.push({
          id: 'chosen-model',
          message: `Router selected: ${snapshot.selected_model}`,
          timing: Math.max(0, parseIsoMs(snapshot.last_updated) - createdAtMs),
          status: 'completed',
          nodeIds: [chosenNode],
        });
      }
    }

    return events;
  }

  private updateStateFromScenario(snapshot: RouterTraceSnapshot): void {
    // show all events
    this.state.currentStep = this.scenario.events.length;
    this.state.completedEvents = this.scenario.events
      .filter((e) => e.status === 'completed')
      .map((e) => e.id);

    // default upcoming for core nodes
    const upcoming = new Set(this.scenario.activeNodes);

    // reset statuses
    this.state.nodes = this.state.nodes.map((n) => ({ ...n, status: upcoming.has(n.id) ? ('upcoming' as NodeStatus) : ('dormant' as NodeStatus) }));

    // apply event statuses
    for (const event of this.scenario.events) {
      for (const nodeId of event.nodeIds) {
        const node = this.state.nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        if (event.status === 'running') node.status = 'active';
        else if (event.status === 'completed') node.status = 'completed';
        else if (event.status === 'error') node.status = 'error';
      }
    }

    // chosen model highlighting
    if (snapshot.selected_model) {
      const chosen = mapSelectedModelToNodeId(snapshot.selected_model);
      if (chosen) {
        for (const n of this.state.nodes) {
          if (n.id === chosen) n.status = 'chosen';
          else if (n.id.startsWith('model-')) n.status = 'skipped';
        }
      }
    }

    if (this.scenario.events.length > 0) {
      this.state.currentEvent = this.scenario.events[this.scenario.events.length - 1];
    }
  }

  private notifyStateChange(): void {
    this.onStateChange({ ...this.state });
  }

  public getState(): AnimationState {
    return { ...this.state };
  }

  public play(): void {
    console.warn('Play/Pause not supported in LLM Router real-time mode');
  }
  public pause(): void {
    console.warn('Play/Pause not supported in LLM Router real-time mode');
  }
  public reset(): void {
    this.lastRunId = null;
    this.currentSnapshot = null;
    this.state = this.getInitialState();
    this.notifyStateChange();
  }
  public next(): void {
    console.warn('Manual step navigation not supported in LLM Router real-time mode');
  }
  public setSpeed(_speed?: number): void {
    console.warn('Speed control not supported in LLM Router real-time mode');
  }
}


