import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { cookies, headers } from 'next/headers';
import { checkLoginRateLimit, recordLoginAttempt, getClientIP } from '@/lib/rate-limit';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  const headersList = await headers();
  const clientIP = getClientIP(new Request(request.url, {
    headers: headersList,
  }));

  // Check rate limit
  const rateLimit = checkLoginRateLimit(clientIP);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many login attempts. Try again in ${rateLimit.blockedFor} minutes.`,
        blocked: true,
        blockedFor: rateLimit.blockedFor
      },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { password } = body;

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  // Limit password length to prevent DoS
  if (password.length > 100) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
  }

  let passwordHash: string;
  try {
    passwordHash = env.PASSWORD_HASH;
  } catch {
    console.error('PASSWORD_HASH not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const isMatch = await bcrypt.compare(password, passwordHash);

  if (!isMatch) {
    recordLoginAttempt(clientIP, false);
    const updatedLimit = checkLoginRateLimit(clientIP);

    return NextResponse.json(
      {
        error: 'Invalid password',
        remainingAttempts: updatedLimit.remaining
      },
      { status: 401 }
    );
  }

  // Reset rate limit on successful login
  recordLoginAttempt(clientIP, true);

  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const token = await new SignJWT({
    admin: true,
    iat: Math.floor(Date.now() / 1000)
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(secret);

  (await cookies()).set('auth_token', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    maxAge: 3600, // 1 hour
    path: '/',
  });

  return NextResponse.json({ message: 'Login successful' });
}
