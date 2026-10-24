// BuscoJobs.pt — Portuguese job board (Next.js SPA)
//
// The site is a client-rendered Next.js app. Listings are server-rendered into
// the embedded `__NEXT_DATA__` JSON under props.pageProps.resultadosIniciales.ofertas.
//
// Free-text keyword search is only available through their token-gated POST API,
// but the IT category landing page IS server-side filtered to tech roles:
//   https://www.buscojobs.pt/vagas/ts1017/trabalho-de-tecnologia-da-informacao       (page 1)
//   https://www.buscojobs.pt/vagas/ts1017/trabalho-de-tecnologia-da-informacao/{N}   (page N)
// We page through that category and refine by keyword ourselves.
// Detail URL is `/${slug(CargoVacante)}-ID-${IdOferta}`.
//
// The whole domain sits behind AWS WAF, which answers datacenter IPs (the VPS)
// with a 405 captcha page (`x-amzn-waf-action: captcha`). That can't be solved
// from here, so it is reported as a block rather than a generic HTTP error.
// The category pages are the same for every keyword, so one fetch (or one
// block) is shared by all the queries of an ingest run.

import type { JobListing, JobSearchParams } from '../types';
import { cleanHtmlText } from '../helpers';

const BASE_URL = 'https://www.buscojobs.pt';
// ts1017 = "Tecnologia da informação" category (server-side filtered to tech)
const IT_CATEGORY_PATH = '/vagas/ts1017/trabalho-de-tecnologia-da-informacao';
const MAX_PAGES = 5; // ~15 offers/page
const CATEGORY_CACHE_MS = 10 * 60 * 1000;

let categoryCache: { at: number; offers: Promise<BuscoJobsOffer[]> } | null = null;

interface BuscoJobsOffer {
  IdOferta: number;
  CargoVacante: string;
  NombreEmpresa?: string | null;
  Descripcion?: string | null;
  FechaInicio?: string | null;
  ArchivoLogoEmpresa?: string | null;
  PermiteTeletrabajo?: number;
  PermiteTrabajoHibrido?: number;
  Ciudad?: { Nombre?: string } | null;
  Departamento?: { Nombre?: string } | null;
  Pais?: { Nombre?: string } | null;
}

export async function searchBuscoJobs(params: JobSearchParams): Promise<JobListing[]> {
  try {
    const offers = await getCategoryOffers();
    const normalizedKeyword = normalize((params.keyword || '').trim());

    const jobs: JobListing[] = [];
    for (const offer of offers) {
      const title = cleanHtmlText(offer.CargoVacante);
      const description = cleanHtmlText(offer.Descripcion || '');

      // Best-effort keyword filter (SSR payload isn't keyword-filtered)
      if (normalizedKeyword) {
        const haystack = normalize(`${title} ${description}`);
        if (!haystack.includes(normalizedKeyword)) continue;
      }

      jobs.push(toJobListing(offer, title, description));
    }

    return jobs.slice(0, params.limit || 50);
  } catch (err) {
    console.error('BuscoJobs scraping error:', err);
    throw err;
  }
}

function getCategoryOffers(): Promise<BuscoJobsOffer[]> {
  if (!categoryCache || Date.now() - categoryCache.at > CATEGORY_CACHE_MS) {
    categoryCache = { at: Date.now(), offers: fetchCategoryOffers() };
  }
  return categoryCache.offers;
}

async function fetchCategoryOffers(): Promise<BuscoJobsOffer[]> {
  // Page 1 first: when the WAF blocks it, it blocks the rest too.
  const first = await fetchOffers(`${BASE_URL}${IT_CATEGORY_PATH}`);
  const rest = await Promise.all(
    Array.from({ length: MAX_PAGES - 1 }, (_, i) =>
      fetchOffers(`${BASE_URL}${IT_CATEGORY_PATH}/${i + 2}`)
    )
  );

  // Deduplicate by offer id across pages
  const byId = new Map<number, BuscoJobsOffer>();
  for (const offer of [first, ...rest].flat()) {
    if (offer?.IdOferta && offer.CargoVacante) byId.set(offer.IdOferta, offer);
  }
  return Array.from(byId.values());
}

async function fetchOffers(url: string): Promise<BuscoJobsOffer[]> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
      'Referer': `${BASE_URL}/`,
    },
    next: { revalidate: 300 },
  });

  if (response.headers.get('x-amzn-waf-action')) {
    throw new Error(`BuscoJobs blocked by AWS WAF ${response.headers.get('x-amzn-waf-action')} (HTTP ${response.status}); this IP can't reach the site`);
  }
  if (!response.ok) {
    throw new Error(`BuscoJobs fetch error: ${response.status}`);
  }

  const html = await response.text();
  return extractOffers(html);
}

function extractOffers(html: string): BuscoJobsOffer[] {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return [];

  try {
    const data = JSON.parse(match[1]);
    const offers = data?.props?.pageProps?.resultadosIniciales?.ofertas;
    return Array.isArray(offers) ? offers : [];
  } catch {
    return [];
  }
}

function toJobListing(
  offer: BuscoJobsOffer,
  title: string,
  description: string
): JobListing {
  const location =
    offer.Ciudad?.Nombre ||
    offer.Departamento?.Nombre ||
    offer.Pais?.Nombre ||
    'Portugal';

  let jobType = 'On-site';
  if (offer.PermiteTeletrabajo) jobType = 'Remote';
  else if (offer.PermiteTrabajoHibrido) jobType = 'Hybrid';

  return {
    id: `buscojobs-${offer.IdOferta}`,
    source: 'buscojobs' as const,
    title,
    company: cleanHtmlText(offer.NombreEmpresa || '') || 'Empresa não identificada',
    description,
    url: `${BASE_URL}/${slugify(offer.CargoVacante)}-ID-${offer.IdOferta}`,
    location: cleanHtmlText(location),
    jobType,
    companyLogo: offer.ArchivoLogoEmpresa?.startsWith('http')
      ? offer.ArchivoLogoEmpresa
      : undefined,
    tags: [],
    postedAt: offer.FechaInicio ? new Date(offer.FechaInicio) : undefined,
    country: 'pt',
  };
}

// Matches the site's own slug logic: lowercase, strip accents, non-alphanumeric → '-'
function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
