// Input Sanitization Utilities
// Prevents XSS and other injection attacks

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content - allows safe tags
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    // Force all links to open in new tab safely
    ADD_ATTR: ['target', 'rel'],
    FORCE_BODY: true,
  });
}

/**
 * Sanitize to plain text - removes all HTML
 */
export function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }).trim();
}

/**
 * Sanitize and validate URL
 * Only allows http and https protocols
 */
export function sanitizeURL(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);

    // Only allow safe protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    // Reconstruct URL to normalize it
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex - not perfect but catches most issues
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  if (!isValidEmail(email)) {
    return null;
  }
  return email.trim().toLowerCase();
}

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength);
}

/**
 * Sanitize filename - removes dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove illegal chars
    .replace(/\.{2,}/g, '.') // Prevent directory traversal
    .replace(/^\.+/, '') // Remove leading dots
    .trim()
    .slice(0, 255); // Max filename length
}

/**
 * Sanitize JSON string - validates and re-serializes
 */
export function sanitizeJSON(jsonString: string): string | null {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

/**
 * Escape string for use in regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove null bytes and other dangerous control characters
 */
export function sanitizeControlChars(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  // Remove null bytes and other control characters except newlines and tabs
  return str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

/**
 * Sanitize user input for database queries
 * Note: This is a defense-in-depth measure. Always use parameterized queries.
 */
export function sanitizeForDB(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return sanitizeControlChars(str)
    .replace(/'/g, "''") // Escape single quotes
    .trim();
}

/**
 * Create a safe slug from a string
 */
export function createSlug(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validate and sanitize an integer
 */
export function sanitizeInt(
  value: unknown,
  options: { min?: number; max?: number; defaultValue?: number } = {}
): number {
  const { min, max, defaultValue = 0 } = options;

  const num = typeof value === 'number' ? value : parseInt(String(value), 10);

  if (isNaN(num)) {
    return defaultValue;
  }

  let result = Math.floor(num);

  if (min !== undefined && result < min) {
    result = min;
  }

  if (max !== undefined && result > max) {
    result = max;
  }

  return result;
}

/**
 * Sanitize an array of strings
 */
export function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr
    .filter((item) => typeof item === 'string')
    .map((item) => sanitizeText(item))
    .filter((item) => item.length > 0);
}
