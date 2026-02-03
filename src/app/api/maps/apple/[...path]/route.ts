import { NextRequest, NextResponse } from 'next/server';

const APPLE_BASE_URL = 'https://maps-api.apple.com/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  const apiKey =
    process.env.APPLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_APPLE_MAPS_API_KEY ||
    '';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Apple Maps API key is not configured.' },
      { status: 500 }
    );
  }

  const path = params.path?.join('/') ?? '';
  if (!path) {
    return NextResponse.json(
      { error: 'Missing Apple Maps API path.' },
      { status: 400 }
    );
  }

  const upstreamUrl = new URL(`${APPLE_BASE_URL}/${path}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
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
