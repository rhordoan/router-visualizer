import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { IceChatTraceSnapshot, IceChatTraceStep } from '@/lib/iceChatTraceTypes';
import { setLatestIceChatTrace } from '../_iceChatTraceStore';

interface IceChatToolTraceItem {
  tool: string;
  system: string;
  success: boolean;
  duration_ms: number;
  args?: Record<string, unknown>;
  result?: unknown;
  schema?: Record<string, unknown>;
}

interface IceChatResponse {
  message_id?: string;
  conversation_id?: string;
  response?: string;
  tool_trace?: IceChatToolTraceItem[];
  agent_model?: string;
  agent_duration_ms?: number;
  processing_time?: number;
  error?: string;
}

/**
 * Map an ICE-chat system-of-record to one or more Meta-Orchestrator blueprint node IDs.
 */
function systemToNodeIds(system: string, tool: string): string[] {
  const s = system.toLowerCase();
  const t = tool.toLowerCase();

  if (s === 'jira' || t.startsWith('jira_')) return ['atl-rest'];
  if (s === 'servicenow' || t.includes('incident') || t.includes('change_request') || t.includes('work_note') || t.includes('knowledge_base') || t.includes('similar_ticket')) return ['snow-rest'];
  if (s === 'microsoft graph' || t.includes('email') || t.includes('calendar') || t.includes('meeting') || t.includes('draft') || t.includes('reply') || t === 'send_email') return ['m365-graph'];
  if (s === 'internal it docs' || t.includes('search_it_docs') || t.includes('knowledge_gap') || t.includes('runbook') || t.includes('resolution_steps')) return ['rag-tool', 'vectordb', 'embedder'];

  return [];
}

const mkStep = (
  runId: string,
  stepType: string,
  label: string,
  nodeIds: string[],
  status: IceChatTraceStep['status'],
  atMs: number,
  description: string | null = null,
  tool?: string,
  system?: string,
  args?: Record<string, unknown>,
  result?: unknown,
  schema?: Record<string, unknown>,
): IceChatTraceStep => ({
  id: `${runId}:${stepType}`,
  step_type: stepType,
  label,
  node_ids: nodeIds,
  status,
  timestamp: new Date(atMs).toISOString(),
  duration_ms: null,
  description,
  tool,
  system,
  args,
  result,
  schema,
});

/**
 * POST /api/ice-chat/run
 *
 * Proxies a chat message to the ICE-chat backend and synthesises a
 * Meta-Orchestrator trace snapshot so the visualizer can animate in real-time.
 */
export async function POST(req: Request) {
  try {
    const baseUrl = (process.env.ICE_CHAT_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const backendUrl = `${baseUrl}/api/v1/chat/message`;

    const body = (await req.json()) as { message?: string; conversation_id?: string };
    const userQuery = body.message || null;

    const runId = randomUUID();
    const startedAtMs = Date.now();

    // Seed an initial "running" trace so the UI shows the orchestrator activating
    // before the (potentially slow) ICE-chat response arrives.
    const initialSteps: IceChatTraceStep[] = [
      mkStep(runId, 'helpbot-chat-recv', 'Query received', ['helpbot-chat', 'nat-serve'], 'completed', startedAtMs),
      mkStep(runId, 'workflow-config', 'Config loaded', ['workflow-config'], 'completed', startedAtMs + 10),
      mkStep(runId, 'react-agent-start', 'Agent started', ['react-agent'], 'running', startedAtMs + 20),
      mkStep(runId, 'llm-orchestration', 'Intent classification', ['llm-orchestration', 'nim-services'], 'running', startedAtMs + 30),
      mkStep(runId, 'intent-classify', 'Classifying intent', ['intent-classify'], 'running', startedAtMs + 40),
      mkStep(runId, 'tool-select', 'Tool selection', ['tool-select', 'tool-registry'], 'pending', startedAtMs + 50),
      mkStep(runId, 'a2a-delegate', 'A2A delegation', ['a2a-delegate'], 'pending', startedAtMs + 60),
      mkStep(runId, 'domain-it', 'IT Agent processing', ['domain-it'], 'pending', startedAtMs + 70),
    ];

    const initialSnapshot: IceChatTraceSnapshot = {
      run_id: runId,
      user_query: userQuery,
      assistant_response: null,
      steps: initialSteps,
      created_at: new Date(startedAtMs).toISOString(),
      last_updated: new Date(startedAtMs).toISOString(),
      error: null,
    };

    setLatestIceChatTrace(initialSnapshot);

    // Call the ICE-chat backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userQuery || '',
        conversation_id: body.conversation_id || null,
      }),
      cache: 'no-store',
    });

    const finishedAtMs = Date.now();
    const totalDurationMs = finishedAtMs - startedAtMs;

    let data: IceChatResponse | null = null;
    try {
      const text = await response.text();
      data = text ? (JSON.parse(text) as IceChatResponse) : null;
    } catch {
      data = null;
    }

    const assistantResponse = data?.response || null;
    const toolTrace: IceChatToolTraceItem[] = data?.tool_trace || [];
    const finalStatus = response.ok ? ('completed' as const) : ('error' as const);

    // Collect unique platform node IDs activated by tools
    const platformNodeIds = new Set<string>();
    const usesRag = toolTrace.some((t) =>
      systemToNodeIds(t.system, t.tool).includes('rag-tool')
    );
    toolTrace.forEach((t) => {
      systemToNodeIds(t.system, t.tool).forEach((n) => platformNodeIds.add(n));
    });

    const t = (offset: number) => finishedAtMs - totalDurationMs + offset;

    // Build finalized orchestrator flow steps
    const finalSteps: IceChatTraceStep[] = [
      mkStep(runId, 'helpbot-chat-recv', 'Query received', ['helpbot-chat', 'nat-serve'], 'completed', t(0)),
      mkStep(runId, 'workflow-config', 'Config loaded', ['workflow-config'], 'completed', t(10)),
      mkStep(runId, 'react-agent-start', 'Agent started', ['react-agent'], 'completed', t(20)),
      mkStep(runId, 'llm-orchestration', 'Intent classification', ['llm-orchestration', 'nim-services'], 'completed', t(30)),
      mkStep(runId, 'intent-classify', 'Intent classified: IT operations', ['intent-classify'], 'completed', t(40)),
      mkStep(runId, 'tool-select', 'Tools selected', ['tool-select', 'tool-registry'], finalStatus, t(50)),
      mkStep(runId, 'a2a-delegate', 'Delegating to IT Agent', ['a2a-delegate'], finalStatus, t(60)),
      mkStep(runId, 'domain-it', 'IT Agent processing', ['domain-it'], finalStatus, t(70), `${toolTrace.length} tool call${toolTrace.length !== 1 ? 's' : ''}`),
    ];

    // Add one step per unique platform node group (deduped by node ID set)
    // Keep args/result from the first matching item so the Payload Inspector shows live data.
    const seen = new Set<string>();
    for (const item of toolTrace) {
      const nodeIds = systemToNodeIds(item.system, item.tool);
      if (nodeIds.length === 0) continue;
      const key = nodeIds.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      finalSteps.push(
        mkStep(
          runId,
          `tool:${key}`,
          `${item.system}: ${item.tool}`,
          nodeIds,
          item.success ? 'completed' : 'error',
          t(80),
          null,
          item.tool,
          item.system,
          item.args,
          item.result,
          item.schema,
        )
      );
    }

    if (usesRag) {
      finalSteps.push(mkStep(runId, 'rag-retrieval', 'RAG knowledge retrieval', ['rag-tool', 'vectordb', 'embedder'], finalStatus, t(85)));
    }

    finalSteps.push(
      mkStep(runId, 'llm-summarize', 'Summarizing response', ['llm-summarize', 'nim-services'], finalStatus, t(90)),
      mkStep(runId, 'helpbot-chat-resp', 'Response delivered', ['helpbot-chat'], finalStatus, new Date(finishedAtMs).toISOString() as unknown as number),
    );

    const finalSnapshot: IceChatTraceSnapshot = {
      run_id: runId,
      user_query: userQuery,
      assistant_response: assistantResponse,
      steps: finalSteps,
      created_at: new Date(startedAtMs).toISOString(),
      last_updated: new Date(finishedAtMs).toISOString(),
      error: response.ok ? null : `Backend error: ${response.status} ${response.statusText}`,
    };

    setLatestIceChatTrace(finalSnapshot);

    if (!response.ok) {
      return NextResponse.json(
        { error: `ICE-chat backend error: ${response.statusText}`, details: data },
        { status: response.status }
      );
    }

    return NextResponse.json(
      { run_id: runId, response: assistantResponse, tool_trace: toolTrace },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    try {
      const now = new Date().toISOString();
      setLatestIceChatTrace({
        run_id: randomUUID(),
        user_query: null,
        assistant_response: null,
        steps: [],
        created_at: now,
        last_updated: now,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch {
      // ignore store failures
    }
    return NextResponse.json(
      { error: 'Failed to reach ICE-chat backend', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
