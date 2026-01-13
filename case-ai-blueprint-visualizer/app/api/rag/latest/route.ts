import { NextResponse } from 'next/server';
import { getLatestRAGTrace } from '../_traceStore';

/**
 * Returns the latest synthesized trace snapshot for the NVIDIA RAG visualizer.
 *
 * GET /api/rag/latest -> RAGTraceSnapshot | null
 */
export async function GET() {
  try {
    const data = getLatestRAGTrace();
    return NextResponse.json(data ?? null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch latest RAG trace',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
