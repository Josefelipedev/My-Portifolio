// API error helpers — ported from the web app's src/lib/api-utils.ts. Routes
// throw these and the app's onError handler maps them to the right status +
// the shared { error, code } envelope.

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

/** Throws Errors.BadRequest for any missing/empty required field. */
export function validateRequired(fields: Record<string, unknown>, required: string[]): void {
  for (const field of required) {
    const value = fields[field];
    if (value === undefined || value === null || value === '') {
      throw Errors.BadRequest(`${field} is required`);
    }
  }
}
