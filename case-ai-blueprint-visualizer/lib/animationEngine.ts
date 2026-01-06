import { Blueprint, Scenario, BlueprintNode, EventStep, NodeStatus } from './types';

export interface AnimationState {
  currentStep: number;
  isPlaying: boolean;
  speed: number;
  nodes: BlueprintNode[];
  completedEvents: string[];
  currentEvent: EventStep | null;
}

export class AnimationEngine {
  private state: AnimationState;
  private scenario: Scenario;
  private blueprint: Blueprint;
  private timeoutId: NodeJS.Timeout | null = null;
  private onStateChange: (state: AnimationState) => void;

  constructor(
    blueprint: Blueprint,
    scenario: Scenario,
    onStateChange: (state: AnimationState) => void
  ) {
    this.blueprint = blueprint;
    this.scenario = scenario;
    this.onStateChange = onStateChange;
    this.state = this.getInitialState();
  }

  private getInitialState(): AnimationState {
    return {
      currentStep: 0,
      isPlaying: false,
      speed: 1,
      nodes: this.blueprint.nodes.map(node => ({
        ...node,
        status: 'dormant' as NodeStatus,
      })),
      completedEvents: [],
      currentEvent: null,
    };
  }

  public play(): void {
    if (this.state.currentStep >= this.scenario.events.length) {
      this.reset();
    }
    this.state.isPlaying = true;
    this.executeNextStep();
  }

  public pause(): void {
    this.state.isPlaying = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.notifyStateChange();
  }

  public reset(): void {
    this.state = this.getInitialState();
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.notifyStateChange();
  }

  public next(): void {
    if (this.state.currentStep < this.scenario.events.length) {
      this.executeStep(this.state.currentStep);
      this.state.currentStep++;
      this.notifyStateChange();
    }
  }

  public setSpeed(speed: number): void {
    this.state.speed = speed;
    this.notifyStateChange();
  }

  private executeNextStep(): void {
    if (!this.state.isPlaying || this.state.currentStep >= this.scenario.events.length) {
      this.state.isPlaying = false;
      this.notifyStateChange();
      return;
    }

    const currentEvent = this.scenario.events[this.state.currentStep];
    this.executeStep(this.state.currentStep);
    
    this.state.currentStep++;
    this.notifyStateChange();

    // Calculate delay based on timing difference and speed
    // Speed multiplier: higher values = faster animation, lower values = slower
    let delay = 2000; // Default 2 seconds
    if (this.state.currentStep < this.scenario.events.length) {
      const nextEvent = this.scenario.events[this.state.currentStep];
      const timingDiff = nextEvent.timing - currentEvent.timing;
      // Multiply by 3 to make animation significantly slower
      // At speed=1, animation is 3x slower than original
      delay = Math.max(500, (timingDiff * 3) / this.state.speed);
    }

    this.timeoutId = setTimeout(() => {
      this.executeNextStep();
    }, delay);
  }

  private executeStep(stepIndex: number): void {
    const event = this.scenario.events[stepIndex];
    this.state.currentEvent = event;

    // Mark event as completed or update status
    if (event.status === 'completed' || event.status === 'running') {
      this.state.completedEvents.push(event.id);
    }

    // Update node statuses
    this.state.nodes = this.state.nodes.map(node => {
      const newStatus = this.getNodeStatus(node.id, stepIndex);
      return { ...node, status: newStatus };
    });
  }

  private getNodeStatus(nodeId: string, currentStep: number): NodeStatus {
    // Check if this node is in the chosen path
    const isInChosenPath = this.scenario.chosenPath?.includes(nodeId);
    
    // Get all events up to current step
    const eventsUpToNow = this.scenario.events.slice(0, currentStep + 1);
    
    // Check if node appears in completed events
    const hasBeenActivated = eventsUpToNow.some(event => 
      event.nodeIds.includes(nodeId) && 
      (event.status === 'completed' || event.status === 'running')
    );

    // Check if node is currently active
    const currentEvent = this.scenario.events[currentStep];
    const isCurrentlyActive = currentEvent?.nodeIds.includes(nodeId) && 
                              currentEvent?.status === 'running';

    // Check if node is in upcoming events
    const futureEvents = this.scenario.events.slice(currentStep + 1);
    const isUpcoming = futureEvents.some(event => event.nodeIds.includes(nodeId));

    // Determine status
    if (isCurrentlyActive) {
      return 'active';
    }
    
    if (hasBeenActivated) {
      if (isInChosenPath) {
        return 'chosen';
      }
      return 'completed';
    }

    if (isUpcoming && this.scenario.activeNodes.includes(nodeId)) {
      return 'upcoming';
    }

    // Check if node should be skipped (not in active nodes for this scenario)
    if (!this.scenario.activeNodes.includes(nodeId)) {
      return 'skipped';
    }

    return 'dormant';
  }

  private notifyStateChange(): void {
    this.onStateChange({ ...this.state });
  }

  public getState(): AnimationState {
    return { ...this.state };
  }
}

