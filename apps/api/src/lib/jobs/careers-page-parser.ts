// Job links on a company's own careers page (portal type "custom").
//
// Many consultancies publish their openings as server-rendered HTML instead of
// a public ATS API. This parser keeps the links whose path has a job segment
// followed by an identifier — /jobs/<slug>, /job-detail/<slug>,
// /job-apply/<id>/<slug>, /<company>/job/<id> — on the careers page's own site.
// Pages that build their list in the browser have no such links in the HTML;
// register those as portal type "manual" so the scan skips them.

import { fetchPublicUrl } from '../safe-fetch';
import { cleanHtmlText } from './helpers';

export interface CareersPageJob {
  title: string;
  url: string;
}

const JOB_PATH_SEGMENT =
  /^(jobs?|job-detail|job-apply|vagas?|ofertas?|positions?|openings?|opportunities|oportunidades)$/i;

// Call-to-action text that says nothing about the role ("View Role", "Ver vaga",
// a "Refer" link to /jobs/<id>/refer).
const GENERIC_LINK_TEXT =
  /^(view( role| job| details)?|ver( mais| vaga| oferta)?|saber mais|see more|read more|learn more|more|details|apply( now)?|candidatar|candidata-te|candidate-se|refer( a friend)?|share|partilhar|indicar)$/i;

const ANCHOR_SOURCE = /<a\b([^>]*)>([\s\S]*?)<\/a>/.source;
const HREF = /\bhref\s*=\s*["']([^"']+)["']/i;
const HEADING = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/i;
const TITLE_ELEMENT = /<(div|span|p|strong)\b[^>]*\bclass\s*=\s*["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i;

const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 200;
const JOB_PAGE_TEXT_LENGTH = 4000;

// Some careers sites answer bare fetch() clients with a bot page.
export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

const PAGE_CHROME = /<(script|style|noscript|svg|template|nav|header|footer|form)\b[\s\S]*?<\/\1>/gi;

/** Extracts the job postings linked from a careers page's HTML. */
export function parseCareersPageJobs(html: string, pageUrl: string): CareersPageJob[] {
  const page = new URL(pageUrl);
  const pageKey = normalizeUrl(page);
  const jobs = new Map<string, { title: string; fromSlug: boolean }>();
  const anchor = new RegExp(ANCHOR_SOURCE, 'gi');

  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const href = match[1].match(HREF)?.[1];
    if (!href) continue;

    let url: URL;
    try {
      url = new URL(cleanHtmlText(href), page);
    } catch {
      continue;
    }
    if (!isJobUrl(url, page)) continue;

    const key = normalizeUrl(url);
    if (key === pageKey) continue;

    const linkTitle = titleFromAnchor(match[2]);
    const title = linkTitle || titleFromSlug(url);
    if (!title) continue;

    const existing = jobs.get(key);
    // A card often links twice: once on the title, once on a "View Role" button.
    if (!existing || (existing.fromSlug && linkTitle)) {
      jobs.set(key, { title, fromSlug: !linkTitle });
    }
  }

  return Array.from(jobs, ([url, { title }]) => ({ title, url }));
}

/**
 * Readable text of a job's own page: the <main> (or <article>, or <body>)
 * content without scripts, navigation, header, footer and forms. Careers-page
 * listings carry only a title, so this is what the feed embeds and scores.
 */
export function extractJobPageText(html: string): string {
  const content = html.replace(PAGE_CHROME, ' ');
  const region =
    content.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    content.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    content.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ??
    content;
  // Tags become spaces so "<li>Node</li><li>SQL</li>" does not read "NodeSQL".
  return cleanHtmlText(region.replace(/<[^>]+>/g, ' ')).slice(0, JOB_PAGE_TEXT_LENGTH);
}

export async function fetchJobPageText(url: string): Promise<string> {
  const response = await fetchPublicUrl(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Job page error: ${response.status}`);
  return extractJobPageText(await response.text());
}

function isJobUrl(url: URL, page: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (siteKey(url.hostname) !== siteKey(page.hostname)) return false;

  const segments = url.pathname.split('/').filter(Boolean);
  const jobSegment = segments.findIndex((s) => JOB_PATH_SEGMENT.test(s));
  return jobSegment !== -1 && jobSegment < segments.length - 1;
}

// Registrable part of a host name, so opportunities.noesis.pt and
// www.noesis.pt count as one site while linkedin.com does not.
function siteKey(hostname: string): string {
  const labels = hostname.toLowerCase().split('.');
  const secondLevel = labels[labels.length - 2];
  const tld = labels[labels.length - 1];
  const keep = tld.length === 2 && /^(com|org|net|gov|edu|co)$/.test(secondLevel) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

// Query strings on these links are tracking or locale (?hsLang=en), not the job id.
function normalizeUrl(url: URL): string {
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function titleFromAnchor(innerHtml: string): string {
  const candidates = [
    innerHtml.match(HEADING)?.[2],
    innerHtml.match(TITLE_ELEMENT)?.[2],
    innerHtml,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const text = cleanHtmlText(candidate);
    if (isUsableTitle(text)) return text;
  }
  return '';
}

// /job-detail/backend-developer-golang-8571 -> "Backend Developer Golang"
function titleFromSlug(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    let slug: string;
    try {
      slug = decodeURIComponent(segments[i]);
    } catch {
      continue;
    }
    if (!/[a-z]-[a-z]/i.test(slug)) continue;

    const words = slug
      .replace(/-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, '') // trailing UUID
      .replace(/-\d+$/, '') // trailing numeric id
      .split(/[-_]+/)
      .filter(Boolean);
    const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return isUsableTitle(title) ? title : '';
  }
  return '';
}

function isUsableTitle(text: string): boolean {
  return (
    text.length >= MIN_TITLE_LENGTH &&
    text.length <= MAX_TITLE_LENGTH &&
    !GENERIC_LINK_TEXT.test(text)
  );
}
