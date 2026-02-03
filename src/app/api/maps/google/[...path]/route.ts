import { NextRequest, NextResponse } from 'next/server';
import { enforceAutomationRateLimit } from '@/lib/server/automation-rate-limit';

const GOOGLE_BASE_URL = 'https://maps.googleapis.com/maps/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    '';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps API key is not configured.' },
      { status: 500 }
    );
  }

  try {
    const rateLimit = await enforceAutomationRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Automated transfer rate limit exceeded.',
          reason: rateLimit.reason,
        },
        {
          status: 429,
          headers: rateLimit.retryAfterSeconds
            ? { 'Retry-After': String(rateLimit.retryAfterSeconds) }
            : undefined,
        }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rate limit check failed.' },
      { status: 500 }
    );
  }

  const path = params.path?.join('/') ?? '';
  if (!path) {
    return NextResponse.json(
      { error: 'Missing Google Maps API path.' },
      { status: 400 }
    );
  }

  const upstreamUrl = new URL(`${GOOGLE_BASE_URL}/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });
  upstreamUrl.searchParams.set('key', apiKey);

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const body = await upstreamResponse.text();
  const contentType =
    upstreamResponse.headers.get('content-type') || 'application/json';

  return new NextResponse(body, {
    status: upstreamResponse.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
}
