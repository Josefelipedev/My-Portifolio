import { NextResponse } from 'next/server';
import { initiateLogin } from '@/lib/auth-service';
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
    const { email, password } = body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Senha é obrigatória' }, { status: 400 });
    }

    // Limit password length to prevent DoS
    if (password.length > 100) {
      return NextResponse.json({ error: 'Senha inválida' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') || 'Unknown';

    // Attempt login (step 1)
    const result = await initiateLogin(email, password, {
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

    // Success - code sent to email
    return NextResponse.json({
      success: true,
      message: 'Código de verificação enviado para seu email',
      userId: result.userId,
      requiresVerification: true,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Erro interno. Tente novamente.' },
      { status: 500 }
    );
  }
}
