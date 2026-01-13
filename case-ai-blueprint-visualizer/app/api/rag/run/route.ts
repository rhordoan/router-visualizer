import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { RAGTraceSnapshot, RAGTraceStep } from '@/lib/ragTraceTypes';
import { setLatestRAGTrace } from '../_traceStore';

/**
 * Start a RAG query via NVIDIA RAG backend and synthesize a trace snapshot for the visualizer.
 *
 * POST /api/rag/run -> {NVIDIA_RAG_BACKEND_URL}/v1/rag/query
 */
export async function POST(req: Request) {
  try {
    // NVIDIA RAG backend URL (from Brev launchable)
    const baseUrl = process.env.NVIDIA_RAG_BACKEND_URL || 'http://localhost:8081';
    const backendUrl = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    const body = (await req.json()) as Record<string, unknown>;

    const runId = randomUUID();
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();

    const userQuery = (typeof body.query === 'string' && body.query.length > 0) ? body.query : null;
    const collectionName = process.env.NVIDIA_RAG_COLLECTION || 'multimodal_data';

    const mkStep = (step_type: string, label: string, status: RAGTraceStep['status'], atIso: string): RAGTraceStep => ({
      id: `${runId}:${step_type}`,
      step_type,
      label,
      status,
      timestamp: atIso,
      duration_ms: null,
      description: null,
      metadata: {},
    });

    // Seed a "running" trace so the polling UI can show progress
    const initialSteps: RAGTraceStep[] = [
      mkStep('intake', 'Query intake', 'completed', startedAtIso),
      mkStep('embedding', 'Generating embeddings', 'running', new Date(startedAtMs + 10).toISOString()),
      mkStep('retrieval', 'Retrieving documents', 'pending', new Date(startedAtMs + 50).toISOString()),
      mkStep('reranking', 'Reranking results', 'pending', new Date(startedAtMs + 150).toISOString()),
      mkStep('context_assembly', 'Assembling context', 'pending', new Date(startedAtMs + 200).toISOString()),
      mkStep('guardrails_input', 'Input guardrails check', 'pending', new Date(startedAtMs + 250).toISOString()),
      mkStep('generation', 'Generating response', 'pending', new Date(startedAtMs + 300).toISOString()),
      mkStep('guardrails_output', 'Output guardrails check', 'pending', new Date(startedAtMs + 3300).toISOString()),
      mkStep('output', 'Response ready', 'pending', new Date(startedAtMs + 3400).toISOString()),
    ];

    const initialSnapshot: RAGTraceSnapshot = {
      run_id: runId,
      user_query: userQuery,
      embedding_model: null,
      retrieval_strategy: null,
      generation_model: null,
      retrieved_documents: [],
      guardrails_input: null,
      guardrails_output: null,
      final_response: null,
      steps: initialSteps,
      metrics: {
        total_latency_ms: 0,
        embedding_time_ms: null,
        retrieval_time_ms: null,
        reranking_time_ms: null,
        generation_time_ms: null,
        guardrails_input_time_ms: null,
        guardrails_output_time_ms: null,
        documents_retrieved: 0,
        documents_reranked: 0,
        final_context_tokens: null,
      },
      created_at: startedAtIso,
      last_updated: startedAtIso,
      error: null,
    };

    setLatestRAGTrace(initialSnapshot);

    // Call NVIDIA RAG backend with OpenAI-compatible format
    const upstreamBody: Record<string, unknown> = {
      messages: [
        {
          role: 'user',
          content: userQuery,
        },
      ],
      use_knowledge_base: true,
      temperature: 0.2,
      top_p: 1.0,
      max_tokens: 32768,
      reranker_top_k: 10,
      vdb_top_k: 100,
      vdb_endpoint: 'http://milvus:19530',
      collection_name: collectionName,
      enable_query_rewriting: false,
      enable_reranker: true,
      enable_guardrails: false,
      enable_citations: true,
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      embedding_model: 'nvidia/llama-3.2-nv-embedqa-1b-v2',
      embedding_endpoint: 'nemoretriever-embedding-ms:8000',
      reranker_model: 'nvidia/llama-3.2-nv-rerankqa-1b-v2',
      reranker_endpoint: 'nemoretriever-ranking-ms:8000',
      stream: false,
      ...body,
    };

    let response: Response;
    let data: unknown = null;
    let backendError: string | null = null;

    try {
      response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(process.env.NVIDIA_API_KEY ? { 'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}` } : {}),
        },
        body: JSON.stringify(upstreamBody),
        cache: 'no-store',
      });

      const text = await response.text();
      
      // Parse SSE (Server-Sent Events) format if backend streams
      if (text.includes('data: ')) {
        const lines = text.split('\n').filter(line => line.startsWith('data: '));
        const chunks = lines.map(line => {
          try {
            return JSON.parse(line.replace(/^data: /, ''));
          } catch {
            return null;
          }
        }).filter(Boolean);
        
        // Merge all chunks to get final data
        if (chunks.length > 0) {
          const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>;
          data = lastChunk;
        }
      } else {
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
      }
    } catch (error) {
      backendError = error instanceof Error ? error.message : 'Connection to NVIDIA RAG backend failed';
      response = new Response(null, { status: 503 });
    }

    const finishedAtMs = Date.now();
    const finishedAtIso = new Date(finishedAtMs).toISOString();
    const totalLatency = finishedAtMs - startedAtMs;

    // Extract response data from NVIDIA RAG backend (OpenAI-compatible format)
    const ragResponse = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {};
    
    // Parse OpenAI-compatible response format
    const choices = Array.isArray(ragResponse.choices) ? ragResponse.choices : [];
    const firstChoice = choices[0] as Record<string, any> | undefined;
    const message = firstChoice?.message as Record<string, any> | undefined;
    const finalResponse = (typeof message?.content === 'string') ? message.content : null;

    // Extract model info from response
    const generationModel = (typeof ragResponse.model === 'string') ? ragResponse.model : upstreamBody.model as string | null;
    const embeddingModel = upstreamBody.embedding_model as string | null;
    const retrievalStrategy = 'hybrid-search';
    
    // Extract retrieved documents (may be in citations or context)
    const citations = Array.isArray(ragResponse.citations) ? ragResponse.citations : [];
    const retrievedDocs = citations.length > 0
      ? citations.map((doc: any, idx: number) => ({
          document_id: doc.id || doc.document_id || `doc-${idx}`,
          score: typeof doc.score === 'number' ? doc.score : 0.9 - (idx * 0.1),
          content_preview: typeof doc.content === 'string' ? doc.content.substring(0, 150) : 
                          typeof doc.text === 'string' ? doc.text.substring(0, 150) : '',
          source: doc.source || doc.file_name || doc.metadata?.source || `document-${idx}`,
        }))
      : [];

    // Parse steps/trace from backend response
    const backendSteps = Array.isArray(ragResponse.steps) ? ragResponse.steps : [];
    const finalizedSteps: RAGTraceStep[] = backendSteps.length > 0
      ? backendSteps.map((step: any) => ({
          id: step.id || `${runId}:${step.step_type}`,
          step_type: step.step_type || '',
          label: step.label || step.name || '',
          status: step.status || 'completed',
          timestamp: step.timestamp || finishedAtIso,
          duration_ms: typeof step.duration_ms === 'number' ? step.duration_ms : null,
          description: step.description || null,
          metadata: step.metadata || {},
        }))
      : initialSteps.map((s) => ({
          ...s,
          status: response.ok ? 'completed' : (s.status === 'completed' ? 'completed' : 'error'),
          duration_ms: null,
        }));

    // Parse metrics from backend response (OpenAI usage format)
    const usage = (typeof ragResponse.usage === 'object' && ragResponse.usage !== null) 
      ? ragResponse.usage as Record<string, unknown> 
      : {};
    
    const finalMetrics = {
      total_latency_ms: totalLatency,
      embedding_time_ms: null, // Not exposed in response
      retrieval_time_ms: null, // Not exposed in response
      reranking_time_ms: null, // Not exposed in response
      generation_time_ms: totalLatency, // Approximate
      guardrails_input_time_ms: null,
      guardrails_output_time_ms: null,
      documents_retrieved: retrievedDocs.length,
      documents_reranked: retrievedDocs.length,
      final_context_tokens: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : null,
    };

    // Parse guardrails from backend response
    const guardrailsInput = (typeof ragResponse.guardrails_input === 'object' && ragResponse.guardrails_input !== null)
      ? {
          passed: typeof (ragResponse.guardrails_input as any).passed === 'boolean' ? (ragResponse.guardrails_input as any).passed : true,
          violations: Array.isArray((ragResponse.guardrails_input as any).violations) ? (ragResponse.guardrails_input as any).violations : [],
          action_taken: typeof (ragResponse.guardrails_input as any).action_taken === 'string' ? (ragResponse.guardrails_input as any).action_taken : null,
        }
      : null;

    const guardrailsOutput = (typeof ragResponse.guardrails_output === 'object' && ragResponse.guardrails_output !== null)
      ? {
          passed: typeof (ragResponse.guardrails_output as any).passed === 'boolean' ? (ragResponse.guardrails_output as any).passed : true,
          violations: Array.isArray((ragResponse.guardrails_output as any).violations) ? (ragResponse.guardrails_output as any).violations : [],
          action_taken: typeof (ragResponse.guardrails_output as any).action_taken === 'string' ? (ragResponse.guardrails_output as any).action_taken : null,
        }
      : null;

    const finalSnapshot: RAGTraceSnapshot = {
      run_id: runId,
      user_query: userQuery,
      embedding_model: embeddingModel,
      retrieval_strategy: retrievalStrategy,
      generation_model: generationModel,
      retrieved_documents: retrievedDocs,
      guardrails_input: guardrailsInput,
      guardrails_output: guardrailsOutput,
      final_response: finalResponse,
      steps: finalizedSteps,
      metrics: finalMetrics,
      created_at: startedAtIso,
      last_updated: finishedAtIso,
      error: backendError || (response.ok ? null : 'RAG query failed'),
    };

    setLatestRAGTrace(finalSnapshot);

    return NextResponse.json(
      {
        success: response.ok,
        run_id: runId,
        response: finalResponse,
        error: backendError || (response.ok ? null : 'RAG query failed'),
      },
      { 
        status: response.ok ? 200 : 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to process RAG request',
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
