import { describe, it, expect } from 'vitest';
import { stripHtml, escapeHtml } from '@/lib/html';
import { generateJobsReportHTML } from '@/lib/export';

describe('stripHtml', () => {
  it('returns text content and drops tags', () => {
    expect(stripHtml('<p>Senior <b>Dev</b></p><img src=x onerror="alert(1)">')).toBe('Senior Dev');
  });

  it('handles empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<img src=x onerror='a("b")'>&`)).toBe('&lt;img src=x onerror=&#39;a(&quot;b&quot;)&#39;&gt;&amp;');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('is applied to scraped fields in the PDF report', () => {
    const html = generateJobsReportHTML([{ title: '<img src=x onerror=alert(1)>', company: 'ACME' }]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
