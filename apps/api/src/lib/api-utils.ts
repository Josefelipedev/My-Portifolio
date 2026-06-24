// API error helpers — ported from the web app's src/lib/api-utils.ts. Routes
// throw these and the app's onError handler maps them to the right status +
// the shared { error, code } envelope.

import type { Context } from 'hono';
import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const Errors = {
  BadRequest: (message = 'Bad request') => new ApiError(message, 400, 'BAD_REQUEST'),
  Unauthorized: (message = 'Unauthorized') => new ApiError(message, 401, 'UNAUTHORIZED'),
  Forbidden: (message = 'Forbidden') => new ApiError(message, 403, 'FORBIDDEN'),
  NotFound: (message = 'Not found') => new ApiError(message, 404, 'NOT_FOUND'),
  RateLimited: (message = 'Too many requests') => new ApiError(message, 429, 'RATE_LIMITED'),
  Internal: (message = 'Internal server error') => new ApiError(message, 500, 'INTERNAL_ERROR'),
};

/**
 * Parse + validate a JSON request body against a Zod schema. On failure throws
 * Errors.BadRequest carrying the first issue's message, which the app's onError
 * maps to a 400 { error, code: 'BAD_REQUEST' } envelope. A missing/malformed
 * body is treated as `{}` so object schemas surface field-level messages
 * (e.g. "name is required") instead of a generic "expected object".
 */
export async function parseBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  const raw = await c.req.json().catch(() => ({}));
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw Errors.BadRequest(result.error.issues[0]?.message ?? 'Invalid request body');
  }
  return result.data;
}
