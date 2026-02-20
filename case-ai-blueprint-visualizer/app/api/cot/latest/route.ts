import { NextResponse } from 'next/server';

/**
 * Proxy endpoint for HealthChat Chain-of-Thought API
 * Forwards requests to HealthChat backend and returns real-time CoT data
 * 
 * GET /api/cot/latest
 * Returns the latest CoT message from HealthChat backend
 */
export async function GET() {
  try {
    // Get HealthChat backend URL from environment
    const healthchatBackendUrl = process.env.HEALTHCHAT_BACKEND_URL || 'http://localhost:8000';

    // Build headers (no auth needed - endpoint is public for demo)
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Forward request to HealthChat backend
    const backendUrl = `${healthchatBackendUrl}/api/v1/cot/realtime/latest`;

    console.log(`[CoT Proxy] Fetching from: ${backendUrl}`);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers,
      // Don't cache - we want real-time data
      cache: 'no-store',
    });

    // Handle errors
    if (!response.ok) {
      console.error(`[CoT Proxy] Backend returned ${response.status}`);

      if (response.status === 404) {
        // No messages yet - return null
        return NextResponse.json(null, { status: 200 });
      }

      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Parse and return data
    const data = await response.json();

    console.log(`[CoT Proxy] Successfully fetched message_id: ${data?.message_id}, assistant_response length: ${data?.assistant_response?.length || 0}`);
    if (data?.assistant_response) {
      console.log(`[CoT Proxy] Assistant response preview: "${data.assistant_response.substring(0, 100)}..."`);
    } else {
      console.log(`[CoT Proxy] Assistant response is EMPTY or missing`);
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        // Allow CORS if needed
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        // Disable caching for real-time data
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('[CoT Proxy] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch from HealthChat backend',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
