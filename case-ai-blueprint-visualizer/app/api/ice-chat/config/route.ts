import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ICE_CHAT_URL = process.env.ICE_CHAT_BACKEND_URL ?? 'http://localhost:8000';
  try {
    const res = await fetch(`${ICE_CHAT_URL}/api/v1/chat/config`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Fallback — keep YAML editor functional even when backend is down
    return NextResponse.json({
      llm_model: 'llama3.3:70b',
      llm_api_base: 'http://localhost:8000/v1',
      embedding_model: 'sentence-transformers/all-MiniLM-L6-v2',
    });
  }
}
