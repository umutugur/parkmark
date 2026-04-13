import { FastifyRequest, FastifyReply } from 'fastify';

// We use Node's built-in crypto to verify HMAC-SHA256 JWT signatures
import { createHmac } from 'crypto';

function base64UrlDecode(str: string): string {
  const padded = str + '=='.slice((str.length + 2) % 4 === 0 ? 4 : (str.length + 2) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function signAdminJwt(payload: Record<string, any>, secret: string, expiresIn = 28800): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: now, exp: now + expiresIn };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = base64UrlEncode(createHmac('sha256', secret).update(signingInput).digest());

  return `${signingInput}.${sig}`;
}

export function verifyAdminJwt(token: string, secret: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = base64UrlEncode(createHmac('sha256', secret).update(signingInput).digest());

  if (expectedSig !== sigB64) throw new Error('Invalid signature');

  const claims = JSON.parse(base64UrlDecode(payloadB64));
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return claims;
}

export async function adminAuthenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ statusCode: 401, message: 'Admin authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      return reply.status(500).send({ statusCode: 500, message: 'Admin secret not configured' });
    }

    const decoded = verifyAdminJwt(token, secret);
    if (decoded.role !== 'admin') {
      return reply.status(403).send({ statusCode: 403, message: 'Forbidden' });
    }

    (request as any).adminUser = decoded.username;
  } catch {
    return reply.status(401).send({ statusCode: 401, message: 'Invalid or expired admin token' });
  }
}
