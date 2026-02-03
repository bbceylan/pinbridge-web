import { NextResponse } from 'next/server';

export async function GET() {
  const appleKey =
    process.env.APPLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_APPLE_MAPS_API_KEY ||
    '';
  const googleKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    '';

  return NextResponse.json(
    {
      apple: { configured: appleKey.length > 0 },
      google: { configured: googleKey.length > 0 },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
