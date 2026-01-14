import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that require authentication
const protectedRoutes = ['/admin', '/admin/github', '/admin/projects', '/admin/experiences'];
const protectedApiRoutes = ['/api/projects', '/api/experiences', '/api/github/import', '/api/summarize', '/api/logout'];

// Routes that don't need auth
const publicRoutes = ['/admin/login', '/api/auth/login', '/api/auth/verify', '/api/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Skip public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route needs protection
  const isProtectedPage = protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
  const isProtectedApi = protectedApiRoutes.some(route => pathname.startsWith(route));

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  // No token - redirect or return 401
  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // Verify JWT token
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Token is valid, but we should also check session in DB
    // For performance, we do a lightweight JWT check here
    // Full session validation happens in API routes
    if (!payload.userId || !payload.sessionToken) {
      throw new Error('Invalid token payload');
    }

    return NextResponse.next();
  } catch {
    // Invalid token - clear it and redirect/return 401
    const response = isProtectedApi
      ? NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
      : NextResponse.redirect(new URL('/admin/login', request.url));

    response.cookies.set('auth_token', '', { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
