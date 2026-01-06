import { Blueprint, Scenario, EventStep, NodeStatus } from './types';
import { MessageCoTSnapshot, CoTStep, HealthChatCoTService } from './cotService';
import { AnimationState } from './animationEngine';

export class HealthChatAnimationEngine {
  private state: AnimationState;
  private blueprint: Blueprint;
  private scenario: Scenario;
  private onStateChange: (state: AnimationState) => void;
  private cotService: HealthChatCoTService;
  private currentSnapshot: MessageCoTSnapshot | null = null;
  private lastMessageId: number | null = null;

  constructor(
    blueprint: Blueprint,
    scenario: Scenario,
    onStateChange: (state: AnimationState) => void,
    cotService: HealthChatCoTService
  ) {
    this.blueprint = blueprint;
    this.scenario = scenario;
    this.onStateChange = onStateChange;
    this.cotService = cotService;
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

  // Start real-time polling and animation
  public start(): void {
    this.cotService.startPolling(
      (snapshot, isNew) => this.onNewSnapshot(snapshot, isNew),
      (error) => console.error('Polling error:', error)
    );
  }

  // Stop polling
  public stop(): void {
    this.cotService.stopPolling();
  }

  // Handle new CoT snapshot from polling
  private onNewSnapshot(snapshot: MessageCoTSnapshot, isNew: boolean): void {
    // Check if message ID actually changed (defense against service bugs)
    const messageIdChanged = this.lastMessageId !== null && snapshot.message_id !== this.lastMessageId;
    const isActuallyNew = isNew || messageIdChanged;
    
    this.currentSnapshot = snapshot;
    
    // Only reset state if this is a new message
    if (isActuallyNew) {
      // Update message ID tracking
      this.lastMessageId = snapshot.message_id;
      
      // Reset state for new message
      this.state.completedEvents = [];
      this.state.currentStep = 0;
      
      // Reset all nodes to dormant
      this.state.nodes = this.blueprint.nodes.map(node => ({
        ...node,
        status: 'dormant' as NodeStatus,
      }));
    } else if (this.lastMessageId === null) {
      // Set initial message ID if this is the first poll
      this.lastMessageId = snapshot.message_id;
    }
    
    // ALWAYS update scenario and state from snapshot (real-time sync)
    this.updateScenarioFromSnapshot(snapshot);
    this.updateStateFromSnapshot();
    
    // Notify UI of changes
    this.notifyStateChange();
  }

  // Update scenario with real CoT data
  private updateScenarioFromSnapshot(snapshot: MessageCoTSnapshot): void {
    console.log(`[AnimationEngine] Updating from snapshot, assistant_response length: ${snapshot.assistant_response?.length || 0}`);
    
    // Update query
    this.scenario.query = snapshot.user_query;

    // Convert CoT steps to events
    this.scenario.events = this.convertCoTStepsToEvents(snapshot.cot_steps);

    // Build chat messages with user query + system messages for each step + assistant response
    this.scenario.chatMessages = [
      {
        role: 'user',
        content: snapshot.user_query,
        timing: 0,
      },
    ];

    // Add system messages for each CoT step to show progress in Conversation Flow
    // Group steps by step_type and keep only the last one for each type
    const uniqueSteps: CoTStep[] = [];
    const stepsByType = new Map<string, CoTStep[]>();
    
    // Group steps by their type
    snapshot.cot_steps.forEach((step) => {
      const stepType = step.step_type;
      if (!stepsByType.has(stepType)) {
        stepsByType.set(stepType, []);
      }
      stepsByType.get(stepType)!.push(step);
    });
    
    // Keep only the last step for each type (in original order)
    const seenTypes = new Set<string>();
    for (let i = snapshot.cot_steps.length - 1; i >= 0; i--) {
      const step = snapshot.cot_steps[i];
      if (!seenTypes.has(step.step_type)) {
        seenTypes.add(step.step_type);
        uniqueSteps.unshift(step); // Add at beginning to maintain order
      }
    }
    
    uniqueSteps.forEach((step) => {
      const timing = step.duration_ms || 0;

      // Build detailed message with label and description
      let content = step.label;
      if (step.description) {
        let desc = step.description;
        
        // Format checkmarks and bullets to appear on separate lines
        desc = desc
          .replace(/\s*✓\s*/g, '\n✓ ')
          .replace(/\s*•\s*/g, '\n  • ');
        
        content += `\n${desc}`;
      }

      this.scenario.chatMessages.push({
        role: 'system',
        content: content,
        timing: Math.round(timing), // Use exact timing from backend
      });
    });

    // Add or update assistant response
    const lastStepTiming = snapshot.cot_steps.length > 0 
      ? (snapshot.cot_steps[snapshot.cot_steps.length - 1].duration_ms || 0) 
      : 0;
    
    // Remove any existing assistant message
    this.scenario.chatMessages = this.scenario.chatMessages.filter(msg => msg.role !== 'assistant');
    
    if (snapshot.assistant_response) {
      const cleanResponse = snapshot.assistant_response
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/`{1,3}/g, '');
      
      console.log(`[AnimationEngine] Adding assistant response: "${cleanResponse.substring(0, 100)}..." (${cleanResponse.length} chars)`);
      
      this.scenario.chatMessages.push({
        role: 'assistant',
        content: cleanResponse,
        timing: Math.round(lastStepTiming + 500),
      });
    } else {
      // If no response yet, add a "generating" placeholder
      console.log(`[AnimationEngine] Adding placeholder - no response yet`);
      
      this.scenario.chatMessages.push({
        role: 'assistant',
        content: '⏳ Generating response...',
        timing: Math.round(lastStepTiming + 500),
      });
    }

    // This ensures the full path is visible
    this.scenario.activeNodes = ['intake', 'checking', 'analyzing', 'retrieving', 'analyzing_document', 'augmenting', 'generating', 'validating', 'output', 'suggestions'];
  }

  // Update state (nodes, steps, events) from snapshot - REAL-TIME SYNC
  private updateStateFromSnapshot(): void {
    // Update currentStep to show all events
    this.state.currentStep = this.scenario.events.length;
    
    // Mark all completed events
    this.state.completedEvents = this.scenario.events
      .filter(e => e.status === 'completed')
      .map(e => e.id);
    
    // Define the complete node flow order - MATCHES BACKEND ORDER
    const nodeFlow = ['intake', 'analyzing', 'augmenting', 'retrieving', 'analyzing_document', 'checking', 'generating', 'validating', 'output', 'suggestions'];
    
    // First, mark all nodes as upcoming (they will be processed)
    nodeFlow.forEach(nodeId => {
      const node = this.state.nodes.find(n => n.id === nodeId);
      if (node) {
        node.status = 'upcoming';
      }
    });
    
    // Then update node statuses based on actual events
    this.scenario.events.forEach(event => {
      event.nodeIds.forEach(nodeId => {
        const node = this.state.nodes.find(n => n.id === nodeId);
        if (node) {
          if (event.status === 'completed') {
            node.status = 'completed';
          } else if (event.status === 'running') {
            node.status = 'active';
          } else if (event.status === 'skipped') {
            node.status = 'skipped';
          } else if (event.status === 'error') {
            node.status = 'error';
          } else if (event.status === 'pending') {
            // Keep as upcoming until it starts
            node.status = 'upcoming';
          }
        }
      });
    });
    
    // Set current event to the last one
    if (this.scenario.events.length > 0) {
      this.state.currentEvent = this.scenario.events[this.scenario.events.length - 1];
    }
  }

  // Convert CoT steps to Blueprint events
  private convertCoTStepsToEvents(steps: CoTStep[]): EventStep[] {
    const events: EventStep[] = [];
    
    // Define the complete node flow order - MATCHES BACKEND ORDER
    const nodeFlow = ['intake', 'analyzing', 'augmenting', 'retrieving', 'analyzing_document', 'checking', 'generating', 'validating', 'output', 'suggestions'];
    
    // Intake event - always completed
    events.push({
      id: 'intake-event',
      message: 'User query received',
      timing: 0,
      status: 'completed',
      nodeIds: ['intake'],
    });

    let currentTiming = 0;
    let lastRealStepTiming = 0;

    // Go through each node in the flow
    for (let i = 1; i < nodeFlow.length; i++) { 
      const nodeId = nodeFlow[i];
      
      if (nodeId === 'output' || nodeId === 'suggestions') {
        continue;
      }
      
      const nodeSteps = steps.filter(step => this.mapStepTypeToNodeId(step.step_type) === nodeId);
      const cotStep = nodeSteps.length > 0 ? nodeSteps[nodeSteps.length - 1] : null;
      
      if (cotStep) {
        // This node is actually used
        const timing = cotStep.duration_ms || 0;
        const duration = timing - lastRealStepTiming;
        
        const message = cotStep.label;
        let messageWithDescription = cotStep.label;
        if (cotStep.description) {
          let desc = cotStep.description;
          
          // Format checkmarks and bullets to appear on separate lines (same as chat messages)
          desc = desc
            .replace(/\s*✓\s*/g, '\n✓ ') 
            .replace(/\s*•\s*/g, '\n  • '); 
          
          messageWithDescription += ` - ${desc}`;
        }

        // Determine event status based on backend
        let eventStatus: 'completed' | 'running' | 'pending' | 'skipped' | 'error' = 'completed';
        if (cotStep.status === 'active') {
          eventStatus = 'running'; 
        } else if (cotStep.status === 'error') {
          eventStatus = 'error';
        } else if (cotStep.status !== 'complete') {
          eventStatus = 'pending';
        }
        if (duration > 1000 && eventStatus === 'completed') {
          events.push({
            id: `${cotStep.id}-running`,
            message: `${message} (in progress...)`,
            timing: Math.round(lastRealStepTiming + 1),
            status: 'running',
            nodeIds: [nodeId],
          });
          
          // Add "completed" event at the END of this period with full description
          events.push({
            id: cotStep.id,
            message: messageWithDescription,
            timing: Math.round(timing),
            status: 'completed',
            nodeIds: [nodeId],
          });
        } else {
          // For short durations or still-running events, add single event with full description
          events.push({
            id: cotStep.id,
            message: messageWithDescription,
            timing: Math.round(timing),
            status: eventStatus,
            nodeIds: [nodeId],
          });
        }
        
        lastRealStepTiming = timing;
        currentTiming = timing;
      } else {
        // Node not used - mark as skipped
        const isAfterGenerating = ['validating'].includes(nodeId);
        const hasResponse = this.currentSnapshot?.assistant_response && 
                           this.currentSnapshot.assistant_response.trim().length > 0;
        
        if (!isAfterGenerating || hasResponse) {
          currentTiming += 50;
          
          const nodeLabels: Record<string, string> = {
            'checking': 'Input guardrails',
            'analyzing': 'Analyzing query',
            'retrieving': 'Document retrieval',
            'analyzing_document': 'Analyzing documents',
            'augmenting': 'Context augmentation',
            'generating': 'Response generation',
            'validating': 'Output guardrails',
          };
          
          events.push({
            id: `skip-${nodeId}`,
            message: `${nodeLabels[nodeId] || nodeId} - Not needed for this query`,
            timing: Math.round(currentTiming),
            status: 'skipped',
            nodeIds: [nodeId],
          });
        }
      }
    }
    const hasResponse = this.currentSnapshot?.assistant_response && 
                       this.currentSnapshot.assistant_response.trim().length > 0;
    const hasSuggestions = (this.currentSnapshot?.suggestions_count ?? 0) > 0;
    
    const lastStepTiming = steps.length > 0 ? (steps[steps.length - 1].duration_ms || 0) : currentTiming;
    
    let outputStatus: 'completed' | 'pending' = 'pending';
    let outputMessage = 'Preparing response...';
    
    if (hasResponse) {
      outputStatus = 'completed';
      outputMessage = 'Response ready';
    } else {
      outputStatus = 'pending';
      outputMessage = 'Preparing response...';
    }
    
    events.push({
      id: 'output-event',
      message: outputMessage,
      timing: Math.round(lastStepTiming + 100),
      status: outputStatus,
      nodeIds: ['output'],
    });

    let suggestionsStatus: 'completed' | 'pending' = 'pending';
    let suggestionsMessage = 'Waiting for suggestions...';
    
    if (hasSuggestions) {
      suggestionsStatus = 'completed';
      suggestionsMessage = 'Follow-up suggestions ready';
    } else if (hasResponse) {
      suggestionsStatus = 'pending';
      suggestionsMessage = 'Generating suggestions...';
    } else {
      suggestionsStatus = 'pending';
      suggestionsMessage = 'Waiting for suggestions...';
    }
    
    events.push({
      id: 'suggestions-event',
      message: suggestionsMessage,
      timing: Math.round(lastStepTiming + 200),
      status: suggestionsStatus,
      nodeIds: ['suggestions'],
    });

    return events;
  }

  // Map CoT step_type to Blueprint node ID
  private mapStepTypeToNodeId(stepType: string): string | null {
    const mapping: Record<string, string> = {
      'checking': 'checking',
      'analyzing': 'analyzing',
      'augmenting': 'augmenting',
      'retrieving': 'retrieving',
      'searching': 'retrieving',
      'retrieved': 'retrieving',
      'analyzing_document': 'analyzing_document',
      'generating': 'generating',
      'validating': 'validating',
      'suggestions': 'suggestions',
    };

    return mapping[stepType] || null;
  }

  private notifyStateChange(): void {
    this.onStateChange({ ...this.state });
  }

  public getState(): AnimationState {
    return { ...this.state };
  }

  public play(): void {
    console.warn('Play/Pause not supported in HealthChat real-time mode');
  }

  public pause(): void {
    console.warn('Play/Pause not supported in HealthChat real-time mode');
  }

  public reset(): void {
    this.lastMessageId = null;
    this.state = this.getInitialState();
    this.notifyStateChange();
  }

  public next(): void {
    console.warn('Manual step navigation not supported in HealthChat real-time mode');
  }

  public setSpeed(): void {
    console.warn('Speed control not supported in HealthChat real-time mode');
  }
}
