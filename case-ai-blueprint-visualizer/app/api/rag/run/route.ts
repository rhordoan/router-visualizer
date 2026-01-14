import { randomUUID } from 'crypto';
import type { RAGTraceSnapshot, RAGTraceStep } from '@/lib/ragTraceTypes';
import { setLatestRAGTrace } from '../_traceStore';

/**
 * Start a RAG query via NVIDIA RAG backend and stream pipeline events in real-time.
 *
 * POST /api/rag/run -> Stream SSE events with pipeline_step updates
 */
export async function POST(req: Request) {
  try {
    const baseUrl = process.env.NVIDIA_RAG_BACKEND_URL || 'http://localhost:8081';
    const backendUrl = `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

    const body = (await req.json()) as Record<string, unknown>;

    const runId = randomUUID();
    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();

    const userQuery = (typeof body.query === 'string' && body.query.length > 0) ? body.query : null;
    const collectionName = process.env.NVIDIA_RAG_COLLECTION || 'multimodal_data';

    // Initialize snapshot
    const snapshot: RAGTraceSnapshot = {
      run_id: runId,
      user_query: userQuery,
      embedding_model: null,
      retrieval_strategy: null,
      generation_model: null,
      retrieved_documents: [],
      guardrails_input: null,
      guardrails_output: null,
      final_response: null,
      steps: [],
      metrics: {
        total_latency_ms: 0,
        embedding_time_ms: null,
        retrieval_time_ms: null,
        reranking_time_ms: null,
        generation_time_ms: null,
        documents_retrieved: 0,
        documents_reranked: 0,
        final_context_tokens: null,
      },
      created_at: startedAtIso,
      last_updated: startedAtIso,
      error: null,
    };

    setLatestRAGTrace(snapshot);

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
      stream: true, // Enable streaming
      ...body,
    };

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let finalResponse = '';
        let backendError: string | null = null;

        try {
          const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.NVIDIA_API_KEY ? { 'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}` } : {}),
            },
            body: JSON.stringify(upstreamBody),
            cache: 'no-store',
          });

          if (!response.ok) {
            backendError = `Backend error: ${response.status} ${response.statusText}`;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: backendError })}\n\n`));
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            backendError = 'No response body from backend';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: backendError })}\n\n`));
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;

              // Parse SSE format
              if (line.startsWith('event: ')) {
                const eventType = line.substring(7).trim();
                continue; // Event type line, next line will have data
              }

              if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);

                try {
                  const data = JSON.parse(dataStr);

                  // Check if this is a pipeline_step event
                  if (data.step_type && data.status && data.timestamp) {
                    // This is a pipeline step event
                    const step: RAGTraceStep = {
                      id: `${runId}:${data.step_type}`,
                      step_type: data.step_type,
                      label: getStepLabel(data.step_type),
                      status: mapStatus(data.status),
                      timestamp: data.timestamp,
                      duration_ms: data.duration_ms ?? null,
                      description: null,
                      metadata: data.metadata || {},
                    };

                    // Update snapshot
                    const existingIndex = snapshot.steps.findIndex(s => s.step_type === data.step_type);
                    if (existingIndex >= 0) {
                      snapshot.steps[existingIndex] = step;
                    } else {
                      snapshot.steps.push(step);
                    }

                    snapshot.last_updated = new Date().toISOString();
                    setLatestRAGTrace(snapshot);

                    // Forward to client
                    controller.enqueue(encoder.encode(`event: pipeline_step\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`));
                  }
                  // Check if this is a token chunk
                  else if (data.choices && Array.isArray(data.choices)) {
                    const firstChoice = data.choices[0] as any;

                    // Accumulate response content
                    if (firstChoice?.delta?.content) {
                      finalResponse += firstChoice.delta.content;
                    }

                    // Check if finished
                    if (firstChoice?.finish_reason === 'stop') {
                      // Parse final metrics if available
                      if (data.metrics) {
                        snapshot.metrics = {
                          total_latency_ms: Date.now() - startedAtMs,
                          embedding_time_ms: data.metrics.embedding_time_ms ?? null,
                          retrieval_time_ms: data.metrics.retrieval_time_ms ?? null,
                          reranking_time_ms: data.metrics.context_reranker_time_ms ?? null,
                          generation_time_ms: data.metrics.llm_generation_time_ms ?? null,
                          documents_retrieved: data.metrics.documents_retrieved ?? 0,
                          documents_reranked: data.metrics.documents_reranked ?? 0,
                          final_context_tokens: data.usage?.prompt_tokens ?? null,
                        };
                      }

                      snapshot.final_response = finalResponse;
                      snapshot.last_updated = new Date().toISOString();
                      setLatestRAGTrace(snapshot);
                    }

                    // Forward token chunk to client (optional - for showing response text)
                    controller.enqueue(encoder.encode(`data: ${dataStr}\n\n`));
                  }
                  // Parse citations if available
                  else if (data.citations && Array.isArray(data.citations)) {
                    snapshot.retrieved_documents = data.citations.map((doc: any, idx: number) => ({
                      document_id: doc.id || doc.document_id || `doc-${idx}`,
                      score: typeof doc.score === 'number' ? doc.score : 0.9 - (idx * 0.1),
                      content_preview: typeof doc.content === 'string' ? doc.content.substring(0, 150) :
                                      typeof doc.text === 'string' ? doc.text.substring(0, 150) : '',
                      source: doc.source || doc.file_name || doc.metadata?.source || `document-${idx}`,
                    }));
                    setLatestRAGTrace(snapshot);
                  }
                } catch (parseError) {
                  // Not JSON or malformed, skip
                  console.warn('Failed to parse SSE data:', dataStr);
                }
              }
            }
          }

          // Ensure final snapshot is saved
          if (!snapshot.final_response && finalResponse) {
            snapshot.final_response = finalResponse;
          }
          snapshot.metrics.total_latency_ms = Date.now() - startedAtMs;
          snapshot.last_updated = new Date().toISOString();
          setLatestRAGTrace(snapshot);

        } catch (error) {
          backendError = error instanceof Error ? error.message : 'Connection to NVIDIA RAG backend failed';
          snapshot.error = backendError;
          setLatestRAGTrace(snapshot);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: backendError })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to process RAG request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Helper functions
function getStepLabel(stepType: string): string {
  const labels: Record<string, string> = {
    intake: 'Query intake',
    embedding: 'Generating embeddings',
    retrieval: 'Retrieving documents',
    reranking: 'Reranking results',
    context_assembly: 'Assembling context',
    generation: 'Generating response',
    output: 'Response ready',
  };
  return labels[stepType] || stepType;
}

function mapStatus(status: string): 'pending' | 'running' | 'completed' | 'error' | 'skipped' {
  if (status === 'failed') return 'error';
  if (['pending', 'running', 'completed', 'error', 'skipped'].includes(status)) {
    return status as 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  }
  return 'pending';
}
