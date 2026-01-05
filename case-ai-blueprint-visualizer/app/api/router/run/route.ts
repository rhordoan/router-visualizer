import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { RouterTraceSnapshot, RouterTraceStep } from '@/lib/routerTraceTypes';
import { setLatestRouterTrace } from '../_traceStore';

type RouterControllerConfig = {
  policies?: Array<{
    name?: string;
    llms?: Array<{ name?: string }>;
  }>;
};

async function pickDefaultManualModel(baseUrl: string, policyName: string): Promise<string | null> {
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/config`;
    const res = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = (await res.json()) as RouterControllerConfig;
    const policy =
      cfg.policies?.find((p) => p?.name === policyName) ?? cfg.policies?.[0] ?? null;
    const llmName = policy?.llms?.[0]?.name ?? null;
    return typeof llmName === 'string' && llmName.length > 0 ? llmName : null;
  } catch {
    return null;
  }
}

/**
 * Start a routed run via the llm-router router-controller (OpenAI-compatible),
 * and synthesize a trace snapshot for the visualizer.
 *
 * POST /api/router/run -> {LLM_ROUTER_BACKEND_URL}/v1/chat/completions
 */
export async function POST(req: Request) {
  try {
    // IMPORTANT: llm-router "router-controller" is typically exposed on 8084.
    // (docker-compose in this repo maps router-controller:8084 -> host:8084)
    const baseUrl = process.env.LLM_ROUTER_BACKEND_URL || 'http://localhost:8084';
    const backendUrl = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    const body = (await req.json()) as Record<string, unknown>;

    const runId = randomUUID();
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();

    const messages = (body.messages as Array<{ role?: string; content?: string }> | undefined) || [];
    const userQuery = messages[messages.length - 1]?.content || null;

    const nimParams = (body['nim-llm-router'] as Record<string, unknown> | undefined) || {};
    const policyName = (typeof nimParams.policy === 'string' && nimParams.policy.length > 0) ? nimParams.policy : 'task_router';

    const envDefaultStrategy = process.env.LLM_ROUTER_DEFAULT_STRATEGY;
    const requestedStrategy = (typeof nimParams.routing_strategy === 'string' && nimParams.routing_strategy.length > 0)
      ? nimParams.routing_strategy
      : (typeof envDefaultStrategy === 'string' && envDefaultStrategy.length > 0 ? envDefaultStrategy : 'manual');

    // manual strategy requires a model name (the llm.name in router-controller config)
    const requestedManualModel =
      typeof nimParams.model === 'string' && nimParams.model.length > 0 ? nimParams.model : null;

    const defaultManualModel =
      requestedStrategy === 'manual' && !requestedManualModel
        ? await pickDefaultManualModel(baseUrl, policyName)
        : null;

    const routingStrategy = requestedStrategy || null;

    const mkStep = (step_type: string, label: string, status: RouterTraceStep['status'], atIso: string): RouterTraceStep => ({
      id: `${runId}:${step_type}`,
      step_type,
      label,
      status,
      timestamp: atIso,
      duration_ms: null,
      description: null,
      metadata: {},
    });

    // Seed a "running" trace so the polling UI can show progress even if the upstream call takes time.
    const initialSteps: RouterTraceStep[] = [
      mkStep('intake', 'Query intake', 'completed', startedAtIso),
      mkStep('preprocess', 'Preprocessing', 'completed', new Date(startedAtMs + 5).toISOString()),
      mkStep('classify', 'Classifying prompt', 'running', new Date(startedAtMs + 15).toISOString()),
      mkStep('route', 'Routing decision', 'pending', new Date(startedAtMs + 25).toISOString()),
      mkStep('execute', 'Calling selected model', 'pending', new Date(startedAtMs + 35).toISOString()),
      mkStep('validate', 'Validating response', 'pending', new Date(startedAtMs + 45).toISOString()),
      mkStep('output', 'Output ready', 'pending', new Date(startedAtMs + 55).toISOString()),
    ];

    const initialSnapshot: RouterTraceSnapshot = {
      run_id: runId,
      routing_strategy: routingStrategy,
      user_query: userQuery,
      selected_model: null,
      probabilities: null,
      steps: initialSteps,
      created_at: startedAtIso,
      last_updated: startedAtIso,
      error: null,
    };

    setLatestRouterTrace(initialSnapshot);

    // Ensure request looks like what router-controller expects.
    const upstreamBody: Record<string, unknown> = {
      model: typeof body.model === 'string' ? body.model : '',
      messages,
      stream: typeof body.stream === 'boolean' ? body.stream : false,
      ...body,
      'nim-llm-router': {
        // Provide sensible defaults if caller omitted routing params.
        policy: policyName,
        routing_strategy: requestedStrategy,
        ...(requestedStrategy === 'manual'
          ? { model: requestedManualModel ?? defaultManualModel }
          : (typeof nimParams.model === 'string' ? { model: nimParams.model } : {})),
        ...(typeof nimParams.threshold === 'number' ? { threshold: nimParams.threshold } : {}),
      },
    };

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamBody),
      cache: 'no-store',
    });

    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const finishedAtMs = Date.now();
    const finishedAtIso = new Date(finishedAtMs).toISOString();

    const chosenClassifier = response.headers.get('X-Chosen-Classifier');
    const responseModel =
      (typeof data === 'object' && data !== null && 'model' in data && typeof (data as any).model === 'string')
        ? ((data as any).model as string)
        : null;

    const assistantResponse =
      (typeof data === 'object' &&
        data !== null &&
        'choices' in data &&
        Array.isArray((data as any).choices) &&
        (data as any).choices[0]?.message?.content &&
        typeof (data as any).choices[0].message.content === 'string')
        ? ((data as any).choices[0].message.content as string)
        : null;

    const selectedModel = responseModel || chosenClassifier || null;

    const finalizeStatus = response.ok ? ('completed' as const) : ('error' as const);

    const finalizedSteps: RouterTraceStep[] = initialSteps.map((s) => {
      if (s.step_type === 'classify') {
        return {
          ...s,
          status: response.ok ? 'completed' : 'error',
          timestamp: s.timestamp,
          duration_ms: Math.max(0, finishedAtMs - startedAtMs),
          metadata: {
            ...s.metadata,
            chosen_classifier: chosenClassifier,
          },
        };
      }
      if (s.step_type === 'route') {
        return {
          ...s,
          status: response.ok ? 'completed' : 'error',
          timestamp: new Date(startedAtMs + 25).toISOString(),
          metadata: {
            ...s.metadata,
            selected_model: selectedModel,
          },
        };
      }
      if (s.step_type === 'execute') {
        return {
          ...s,
          status: response.ok ? 'completed' : 'error',
          timestamp: new Date(startedAtMs + 35).toISOString(),
          duration_ms: Math.max(0, finishedAtMs - startedAtMs),
          metadata: {
            ...s.metadata,
            upstream_model: responseModel,
          },
        };
      }
      if (s.step_type === 'validate') {
        return {
          ...s,
          status: finalizeStatus,
          timestamp: new Date(Math.max(startedAtMs + 45, finishedAtMs - 15)).toISOString(),
        };
      }
      if (s.step_type === 'output') {
        return {
          ...s,
          status: finalizeStatus,
          timestamp: finishedAtIso,
          metadata: {
            ...s.metadata,
            assistant_response: assistantResponse,
            assistant_response_preview: assistantResponse ? assistantResponse.slice(0, 600) : null,
            chosen_classifier: chosenClassifier,
            upstream_model: responseModel,
          },
        };
      }
      return s;
    });

    const finalizedSnapshot: RouterTraceSnapshot = {
      ...initialSnapshot,
      selected_model: selectedModel,
      steps: finalizedSteps,
      last_updated: finishedAtIso,
      error: response.ok ? null : `Upstream error: ${response.status} ${response.statusText}`,
    };

    setLatestRouterTrace(finalizedSnapshot);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: data, chosen_classifier: chosenClassifier },
        { status: response.status }
      );
    }

    const responsePayload =
      typeof data === 'object' && data !== null
        ? { ...(data as Record<string, unknown>), chosen_classifier: chosenClassifier }
        : { result: data, chosen_classifier: chosenClassifier };

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    try {
      const now = new Date().toISOString();
      const snapshot = {
        run_id: randomUUID(),
        routing_strategy: null,
        user_query: null,
        selected_model: null,
        probabilities: null,
        steps: [],
        created_at: now,
        last_updated: now,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies RouterTraceSnapshot;
      setLatestRouterTrace(snapshot);
    } catch {
      // ignore store failures
    }
    return NextResponse.json(
      {
        error: 'Failed to start run on llm-router backend',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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




