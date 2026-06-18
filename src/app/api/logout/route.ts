import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logout } from '@/lib/auth-service';
import { buildCookieOptions } from '@/lib/cookie-config';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  // Invalidate session in database
  if (token) {
    await logout(token);
  }

  // Clear cookie — must match the Domain/SameSite the cookie was set with.
  cookieStore.set('auth_token', '', buildCookieOptions({
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
  }));

  return NextResponse.json({ message: 'Logout realizado com sucesso' });
}
