import type { Blueprint, Scenario, EventStep, NodeStatus, PayloadInspection, ProfilerSpan } from './types';
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
  /**
   * Set by reset() — while true any snapshot whose run_id matches lastRunId
   * (the previous run) is silently dropped. Cleared on the first snapshot with
   * a different run_id so the new query can animate from scratch.
   */
  private _waitingForNewRun: boolean = false;
  /** Live payload data keyed by blueprint node ID, populated from real tool call args/results */
  public livePayloads: Record<string, PayloadInspection> = {};
  /** Live NeMo Profiler spans built from the current snapshot's real tool durations */
  public liveProfilerSpans: ProfilerSpan[] = [];

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
    // After reset(), skip any snapshot that still belongs to the previous run.
    if (this._waitingForNewRun) {
      if (snapshot.run_id === this.lastRunId) return; // still the old run — ignore
      this._waitingForNewRun = false; // new run_id arrived — let it through
    }

    const isActuallyNew = isNew || (this.lastRunId !== null && snapshot.run_id !== this.lastRunId);

    if (isActuallyNew) {
      this.lastRunId = snapshot.run_id;
      this.state = this.getInitialState();
    } else if (this.lastRunId === null) {
      this.lastRunId = snapshot.run_id;
    }

    // Scenario update is best-effort: if it throws (e.g. buildLiveProfilerSpans fails
    // for an unexpected snapshot shape), state + notify still run so the map animates.
    try {
      this.updateScenarioFromSnapshot(snapshot);
    } catch (err) {
      console.error('[IceChatEngine] updateScenarioFromSnapshot error:', err);
    }
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

    // Build live payload map from tool-call steps that carry real args/result
    this.livePayloads = {};
    for (const step of snapshot.steps) {
      if (!step.args && !step.result) continue;
      for (const nodeId of step.node_ids) {
        const rawResult = step.result;
        const outputJson: Record<string, unknown> =
          rawResult === null || rawResult === undefined
            ? {}
            : Array.isArray(rawResult)
              ? { items: rawResult }
              : typeof rawResult === 'object'
                ? (rawResult as Record<string, unknown>)
                : { value: rawResult };

        this.livePayloads[nodeId] = {
          nodeId,
          toolName: step.tool ?? step.label,
          inputJson: (step.args ?? {}) as Record<string, unknown>,
          outputJson,
          schema: (step.schema ?? {}) as Record<string, unknown>,
        };
      }
    }

    // Build NeMo Profiler flame chart spans from real tool durations
    try {
      this.liveProfilerSpans = buildLiveProfilerSpans(snapshot);
    } catch {
      this.liveProfilerSpans = [];
    }
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
    // Keep lastRunId so the "waitingForNewRun" guard can still compare against the stale id.
    this._waitingForNewRun = true;
    this.livePayloads = {};
    this.liveProfilerSpans = [];
    this.state = this.getInitialState();
    // Clear conversation/events immediately so the UI shows a blank slate right away
    // instead of the previous query's data until the new snapshot arrives (~1 s).
    this.scenario.chatMessages = [];
    this.scenario.events = [];
    this.notifyStateChange();
  }

  // No-ops — real-time mode only
  public play(): void { /* no-op */ }
  public pause(): void { /* no-op */ }
  public next(): void { /* no-op */ }
  public setSpeed(_speed?: number): void { /* no-op */ }
}

// ── Colour palette for profiler spans ────────────────────────────────────────

const SYSTEM_COLORS: Record<string, string> = {
  'ServiceNow':     'bg-emerald-500',
  'Jira':           'bg-blue-500',
  'Microsoft Graph':'bg-indigo-500',
  'Internal IT Docs':'bg-cyan-500',
};

function buildLiveProfilerSpans(snapshot: IceChatTraceSnapshot): ProfilerSpan[] {
  const spans: ProfilerSpan[] = [];

  // Overall agent run from the react-agent-start step (duration_ms = total run time)
  const agentStep = snapshot.steps.find(s => s.step_type === 'react-agent-start');
  const totalMs = agentStep?.duration_ms ?? (
    parseIsoMs(snapshot.last_updated) - parseIsoMs(snapshot.created_at)
  );
  if (totalMs <= 0) return [];

  spans.push({
    label: 'react_agent',
    duration: Math.round(totalMs),
    widthPct: 100,
    depth: 0,
    color: 'bg-purple-500',
  });

  // One span per system (ServiceNow, Jira, etc.) using the sum of tool durations
  const systemDurations = new Map<string, number>();
  for (const step of snapshot.steps) {
    if (!step.step_type.startsWith('tool:') || !step.system || !step.duration_ms) continue;
    systemDurations.set(step.system, (systemDurations.get(step.system) ?? 0) + step.duration_ms);
  }

  for (const [system, dur] of systemDurations.entries()) {
    spans.push({
      label: system.replace('Microsoft ', 'MS ').replace('Internal IT Docs', 'IT Docs'),
      duration: Math.round(dur),
      widthPct: Math.max((dur / totalMs) * 100, 4),
      depth: 1,
      color: SYSTEM_COLORS[system] ?? 'bg-slate-400',
    });
  }

  // Individual tool calls (depth 2) — only if they have a real duration
  for (const step of snapshot.steps) {
    if (!step.step_type.startsWith('tool:') || !step.tool || !step.duration_ms) continue;
    spans.push({
      label: step.tool,
      duration: Math.round(step.duration_ms),
      widthPct: Math.max((step.duration_ms / totalMs) * 100, 2),
      depth: 2,
      color: SYSTEM_COLORS[step.system ?? ''] ?? 'bg-slate-500',
    });
  }

  // LLM summarization — comes from the llm-summarize step timing
  const summarizeStep = snapshot.steps.find(s => s.step_type === 'llm-summarize');
  const agentStartMs = parseIsoMs(snapshot.created_at);
  if (summarizeStep) {
    const summarizeDur = Math.max(
      parseIsoMs(summarizeStep.timestamp) - agentStartMs,
      300
    );
    spans.push({
      label: 'llm_summarize',
      duration: Math.round(summarizeDur),
      widthPct: Math.max((summarizeDur / totalMs) * 100, 4),
      depth: 1,
      color: 'bg-pink-500',
    });
  }

  return spans;
}
