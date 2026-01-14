import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyCodeAndCreateSession } from '@/lib/auth-service';
import { checkLoginRateLimit, recordLoginAttempt, getClientIP } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);

    // Check rate limit
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Muitas tentativas. Tente novamente em ${rateLimit.blockedFor} minutos.`,
          blocked: true,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { userId, code } = body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Verify code and create session
    const result = await verifyCodeAndCreateSession(userId, code, {
      ipAddress: ip,
      userAgent,
    });

    if (!result.success) {
      recordLoginAttempt(ip, false);
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Set auth cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    // Reset rate limit on successful login
    recordLoginAttempt(ip, true);

    return NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso!',
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Erro interno. Tente novamente.' },
      { status: 500 }
    );
  }
}
