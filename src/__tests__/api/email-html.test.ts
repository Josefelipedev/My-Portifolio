// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMail = vi.hoisted(() => {
  process.env.SMTP_HOST = 'smtp.test';
  process.env.CONTACT_EMAIL = 'owner@example.com';
  return vi.fn(async (_options: { html: string; subject: string }) => ({}));
});
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));

import { sendContactNotification, sendLoginAlert } from '../../../apps/api/src/lib/email';

const sentHtml = () => sendMail.mock.calls[0][0].html;

describe('email templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows contact form text as text, not as markup', async () => {
    await sendContactNotification(
      '<b>Bank</b>',
      'jane@example.com',
      '"><img src=x>',
      'Click <a href="https://evil.example">here</a> to verify your account',
    );

    const html = sentHtml();
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).not.toContain('<b>Bank</b>');
    expect(html).toContain('Click &lt;a href=&quot;https://evil.example&quot;&gt;here&lt;/a&gt;');
    expect(html).toContain('&lt;b&gt;Bank&lt;/b&gt;');
    expect(html).toContain('&quot;&gt;&lt;img src=x&gt;');
  });

  it('builds the reply link with an encoded address and subject', async () => {
    await sendContactNotification('Jane', 'jane+x@example.com', 'Olá & bem-vindo?', 'Hello there, long enough.');

    expect(sentHtml()).toContain(
      'href="mailto:jane%2Bx@example.com?subject=Re%3A%20Ol%C3%A1%20%26%20bem-vindo%3F"',
    );
  });

  it('escapes the User-Agent in the login alert', async () => {
    await sendLoginAlert('owner@example.com', 'Jose', '1.2.3.0', '<script>x</script>', new Date());

    expect(sentHtml()).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(sentHtml()).not.toContain('<script>');
  });
});
