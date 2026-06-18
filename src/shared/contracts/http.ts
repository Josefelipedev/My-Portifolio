// Framework-agnostic typed HTTP client for the portfolio API.
//
// Used by the web frontend to talk to the API service over HTTPS. Validates
// every response against a zod schema at the boundary, and normalizes errors
// into a typed ApiClientError. No Next/Node imports, so it runs on the edge
// (Workers) and in Node alike.

import { z } from 'zod';
import { apiErrorSchema } from './schemas';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface HttpClientOptions {
  /** Base URL of the API service, e.g. "https://api.example.com". */
  baseUrl: string;
  /** Injectable fetch (defaults to global fetch) — eases testing/SSR. */
  fetchImpl?: typeof fetch;
  /**
   * Returns a CSRF token to attach to mutating requests (Phase 3 auth).
   * Sync or async.
   */
  getCsrfToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Send cookies cross-origin (needed once auth moves behind the API). */
  credentials?: RequestCredentials;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getCsrfToken?: HttpClientOptions['getCsrfToken'];
  private readonly credentials: RequestCredentials;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.getCsrfToken = opts.getCsrfToken;
    this.credentials = opts.credentials ?? 'include';
    if (!this.fetchImpl) {
      throw new Error('HttpClient: no fetch implementation available');
    }
  }

  /** Validated request: parses the response body with `schema`. */
  async request<T>(
    method: Method,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    if (method !== 'GET' && this.getCsrfToken) {
      const token = await this.getCsrfToken();
      if (token) headers['x-csrf-token'] = token;
    }

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        credentials: this.credentials,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      throw new ApiClientError(
        `Network error calling ${method} ${path}: ${(cause as Error)?.message ?? 'unknown'}`,
        0,
      );
    }

    const raw = await res.text();
    const json = raw ? safeJsonParse(raw) : null;

    if (!res.ok) {
      const parsed = apiErrorSchema.safeParse(json);
      throw new ApiClientError(
        parsed.success ? parsed.data.error : `Request failed (${res.status})`,
        res.status,
        parsed.success ? parsed.data.code : undefined,
      );
    }

    const result = schema.safeParse(json);
    if (!result.success) {
      throw new ApiClientError(
        `Response from ${method} ${path} did not match the expected schema`,
        res.status,
        'SCHEMA_MISMATCH',
      );
    }
    return result.data;
  }

  get<T>(path: string, schema: z.ZodType<T>) {
    return this.request('GET', path, schema);
  }
  post<T>(path: string, schema: z.ZodType<T>, body?: unknown) {
    return this.request('POST', path, schema, body);
  }
  put<T>(path: string, schema: z.ZodType<T>, body?: unknown) {
    return this.request('PUT', path, schema, body);
  }
  del<T>(path: string, schema: z.ZodType<T>) {
    return this.request('DELETE', path, schema);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
