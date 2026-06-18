// Client-side CSRF utilities
import { apiUrl } from './api-fetch';

/**
 * Fetch CSRF token from the server (or the standalone API once configured).
 */
export async function getCSRFToken(): Promise<string> {
  const res = await fetch(apiUrl('/api/csrf'), { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to get CSRF token');
  }
  const { csrfToken } = await res.json();
  return csrfToken;
}

/**
 * Fetch wrapper that automatically includes CSRF token for state-changing
 * requests. Routes through the API base URL and sends cookies cross-origin
 * (no-op against same-origin when NEXT_PUBLIC_API_BASE_URL is unset).
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();

  // Only add CSRF token for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = await getCSRFToken();

    options.headers = {
      ...options.headers,
      'x-csrf-token': csrfToken,
    };
  }

  return fetch(apiUrl(url), { credentials: 'include', ...options });
}
