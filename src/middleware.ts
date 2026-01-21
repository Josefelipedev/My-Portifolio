import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Routes that require authentication
const protectedRoutes = ['/admin', '/admin/github', '/admin/projects', '/admin/experiences'];
const protectedApiRoutes = ['/api/projects', '/api/experiences', '/api/github/import', '/api/summarize', '/api/logout', '/api/admin'];

// Routes that don't need auth
const publicRoutes = ['/admin/login', '/api/auth/login', '/api/auth/verify', '/api/login'];

// Routes that require CSRF validation for state-changing methods
const csrfProtectedRoutes = [
  '/api/projects',
  '/api/experiences',
  '/api/github/import',
  '/api/summarize',
  '/api/skills',
  '/api/contact',
  '/api/config',
  '/api/admin',
];

// CSRF cookie and header names
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;
  const method = request.method.toUpperCase();

  // Skip public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route needs protection
  const isProtectedPage = protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
  const isProtectedApi = protectedApiRoutes.some(route => pathname.startsWith(route));

  // CSRF validation for state-changing requests
  const isStateChangingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const needsCSRF = csrfProtectedRoutes.some(route => pathname.startsWith(route)) && isStateChangingMethod;

  if (needsCSRF) {
    const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;
    const csrfHeader = request.headers.get(CSRF_HEADER);

    // Validate CSRF token
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader || csrfCookie.length !== 64) {
      // Log the CSRF failure (will be picked up by audit system if needed)
      console.warn(`CSRF validation failed for ${method} ${pathname}`);
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
  }

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
