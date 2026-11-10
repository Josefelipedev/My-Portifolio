// Helpers for the HTML emails the API builds. Text that came from a visitor
// (contact form, User-Agent) or from a scraped job listing goes through
// escapeHtml before it lands in an email body, and links through safeUrl before
// they become an href, so nobody can put their own markup or links in the
// owner's inbox.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) links may become an href; anything else (javascript:, data:) turns into '#'. */
export function safeUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : '#';
}
