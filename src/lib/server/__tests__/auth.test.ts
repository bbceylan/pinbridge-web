/**
 * @jest-environment node
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { getServerSession } from '../auth';

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signJwt(payload: Record<string, any>, secret: string, header: Record<string, any> = { alg: 'HS256', typ: 'JWT' }) {
  const headerB64 = base64Url(JSON.stringify(header));
  const payloadB64 = base64Url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${data}.${signature}`;
}

describe('getServerSession (JWT)', () => {
  const secret = 'test-secret';

  beforeEach(() => {
    process.env.PINBRIDGE_JWT_SECRET = secret;
    process.env.PINBRIDGE_JWT_ISSUER = 'pinbridge';
    process.env.PINBRIDGE_JWT_AUDIENCE = 'pinbridge-web';
  });

  afterEach(() => {
    delete process.env.PINBRIDGE_JWT_SECRET;
    delete process.env.PINBRIDGE_JWT_ISSUER;
    delete process.env.PINBRIDGE_JWT_AUDIENCE;
  });

  it('accepts valid JWT with issuer/audience', async () => {
    const token = signJwt({
      sub: 'user_123',
      role: 'admin',
      premium: true,
      iss: 'pinbridge',
      aud: 'pinbridge-web',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, secret);

    const request = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const session = await getServerSession(request);
    expect(session).toEqual({ userId: 'user_123', role: 'admin', premium: true });
  });

  it('rejects JWT with wrong issuer', async () => {
    const token = signJwt({
      sub: 'user_123',
      iss: 'wrong-issuer',
      aud: 'pinbridge-web',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, secret);

    const request = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const session = await getServerSession(request);
    expect(session).toBeNull();
  });

  it('rejects JWT with wrong audience', async () => {
    const token = signJwt({
      sub: 'user_123',
      iss: 'pinbridge',
      aud: 'wrong-aud',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, secret);

    const request = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const session = await getServerSession(request);
    expect(session).toBeNull();
  });

  it('rejects expired JWT', async () => {
    const token = signJwt({
      sub: 'user_123',
      iss: 'pinbridge',
      aud: 'pinbridge-web',
      exp: Math.floor(Date.now() / 1000) - 10,
    }, secret);

    const request = new NextRequest('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const session = await getServerSession(request);
    expect(session).toBeNull();
  });
});
