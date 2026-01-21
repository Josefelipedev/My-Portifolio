import { NextResponse } from 'next/server';
import { setCSRFCookie, getCSRFToken } from '@/lib/csrf';

// GET /api/csrf - Get or generate a CSRF token
export async function GET() {
  try {
    // Check if a token already exists
    let token = await getCSRFToken();

    // If no token exists, generate a new one
    if (!token) {
      token = await setCSRFCookie();
    }

    return NextResponse.json({ csrfToken: token });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}

// POST /api/csrf - Force refresh the CSRF token
export async function POST() {
  try {
    const token = await setCSRFCookie();
    return NextResponse.json({ csrfToken: token });
  } catch (error) {
    console.error('CSRF token refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh CSRF token' },
      { status: 500 }
    );
  }
}
