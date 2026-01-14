import { NextResponse } from 'next/server';

// Centralized API error handling and response utilities

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Common API errors
export const Errors = {
  BadRequest: (message = 'Bad request') => new ApiError(message, 400, 'BAD_REQUEST'),
  Unauthorized: (message = 'Unauthorized') => new ApiError(message, 401, 'UNAUTHORIZED'),
  Forbidden: (message = 'Forbidden') => new ApiError(message, 403, 'FORBIDDEN'),
  NotFound: (message = 'Not found') => new ApiError(message, 404, 'NOT_FOUND'),
  RateLimited: (message = 'Too many requests') => new ApiError(message, 429, 'RATE_LIMITED'),
  Internal: (message = 'Internal server error') => new ApiError(message, 500, 'INTERNAL_ERROR'),
};

// Success response helper
export function success<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

// Error response helper
export function error(err: ApiError | Error | unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.statusCode }
    );
  }

  // Log unexpected errors
  console.error('Unexpected API error:', err);

  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

// Wrapper for API handlers with automatic error handling
export function withErrorHandling<T>(
  handler: (request: Request, context?: T) => Promise<NextResponse>
) {
  return async (request: Request, context?: T): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (err) {
      return error(err);
    }
  };
}

// Validation helpers
export function validateRequired(
  fields: Record<string, unknown>,
  required: string[]
): void {
  for (const field of required) {
    if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
      throw Errors.BadRequest(`${field} is required`);
    }
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateMinLength(value: string, min: number, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw Errors.BadRequest(`${fieldName} must be at least ${min} characters`);
  }
}

// Cache control headers for public responses
export function withCacheHeaders(
  response: NextResponse,
  maxAge: number = 60,
  staleWhileRevalidate: number = 300
): NextResponse {
  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
  return response;
}

// No-cache headers for private responses
export function withNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  return response;
}
