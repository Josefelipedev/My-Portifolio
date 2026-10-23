// Browser-side helpers for untrusted HTML (scraped job descriptions, titles).

/**
 * Convert HTML to plain text without executing it. Never use
 * `document.createElement('div').innerHTML = html` for this: elements created
 * on the live document fetch resources, so `<img src=x onerror=...>` runs even
 * when the div is never attached. DOMParser documents are inert.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

/** Escape a value for interpolation into an HTML template string. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
