// Client-side CSRF utilities

/**
 * Fetch CSRF token from the server
 */
export async function getCSRFToken(): Promise<string> {
  const res = await fetch('/api/csrf');
  if (!res.ok) {
    throw new Error('Failed to get CSRF token');
  }
  const { csrfToken } = await res.json();
  return csrfToken;
}

/**
 * Fetch wrapper that automatically includes CSRF token for state-changing requests
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

  return fetch(url, options);
}
