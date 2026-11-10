// Job links on a company's own careers page (portal type "custom").
//
// Many consultancies publish their openings as server-rendered HTML instead of
// a public ATS API. This parser keeps the links whose path has a job segment
// followed by an identifier — /jobs/<slug>, /job-detail/<slug>,
// /job-apply/<id>/<slug>, /<company>/job/<id> — on the careers page's own site.
// Pages that build their list in the browser have no such links in the HTML;
// register those as portal type "manual" so the scan skips them.

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
