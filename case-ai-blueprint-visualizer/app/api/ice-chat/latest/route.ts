import { NextResponse } from 'next/server';
import { getLatestIceChatTrace } from '../_iceChatTraceStore';

export async function GET() {
  const snapshot = getLatestIceChatTrace();
  if (!snapshot) {
    return NextResponse.json(null, { status: 404 });
  }
  return NextResponse.json(snapshot, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
