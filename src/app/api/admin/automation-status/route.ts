import { NextRequest, NextResponse } from 'next/server';
import { getAutomationGuardrails } from '@/lib/services/automation-guardrails';
import { getServerSession } from '@/lib/server/auth';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCommand(command: string, args: (string | number)[]) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error('Redis is not configured');
  }

  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Redis error: ${text || response.status}`);
  }

  const data = await response.json();
  return data.result as string | null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let redisOk = false;
  let redisError: string | null = null;

  try {
    const pong = await redisCommand('PING', []);
    redisOk = pong === 'PONG';
  } catch (error) {
    redisOk = false;
    redisError = error instanceof Error ? error.message : 'Redis check failed';
  }

  return NextResponse.json(
    {
      redis: {
        ok: redisOk,
        error: redisError,
        configured: !!(REDIS_URL && REDIS_TOKEN),
      },
      guardrails: {
        free: getAutomationGuardrails('free'),
        premium: getAutomationGuardrails('premium'),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
