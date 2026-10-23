// Job feed — "ingest continuously, match locally". A cron pulls the aggregator
// sources into JobPosting (deduplicated across sources and runs), embeds each
// posting once and stores a stable 0-100 match score against the resume. The
// admin feed and the daily digest read those rows instead of fanning out to
// every board on each search.

import { createHash } from 'node:crypto';
import prisma from '../../db';
import { sendEmail } from '../email';
import { searchJobs, getLastSourceErrors } from './aggregator';
import { normalizeJobKey, getCompletenessScore } from './deduplication';
import { cleanHtmlText } from './helpers';
import { calculateResumeMatchScore } from './scoring';
import { extractKeywordsFromResume, generateSearchQueries } from './smart-search';
import { cosine, embedTexts, getProfileEmbedding, jobText, profileText, EMBED_MODEL } from './semantic';
import { loadFullResumeData } from './resume-data';
import type { JobListing, ResumeData } from './types';

const INGEST_COUNTRIES = process.env.JOBS_INGEST_COUNTRIES || 'pt,remote';
const MAX_QUERIES = Number(process.env.JOBS_INGEST_MAX_QUERIES || 6);
const MAX_AGE_DAYS = 30;
const STALE_DAYS = Number(process.env.JOBS_STALE_DAYS || 10);
const DIGEST_SIZE = Number(process.env.JOBS_DIGEST_SIZE || 5);
const DIGEST_MIN_SCORE = Number(process.env.JOBS_DIGEST_MIN_SCORE || 60);
const DIGEST_WINDOW_DAYS = 3;
// A run older than this without finishedAt crashed; it no longer blocks new runs.
const RUN_TIMEOUT_MS = 30 * 60 * 1000;
// Small batches keep each Ollama call well under its timeout on a busy VPS.
const EMBED_BATCH = 16;
const SCORE_PAGE = 200;
// Bump when the score formula changes so every open posting is rescored.
const SCORING_VERSION = 1;

// Each embedding model puts cosine similarities in its own band, which is
// stretched to 0-1. qwen3's band was calibrated on 328 real PT/remote postings
// (p10 0.32, p90 0.57; non-tech roles ~0.26). Keyword scores above KEYWORD_CAP
// add nothing more.
const SEMANTIC_BANDS: Record<string, [number, number]> = {
  'qwen3-embedding:0.6b': [0.3, 0.65],
  'intfloat/multilingual-e5-large-instruct': [0.7, 0.9],
};
const [SEMANTIC_FLOOR, SEMANTIC_CEIL] = SEMANTIC_BANDS[EMBED_MODEL] || [0.3, 0.65];
const KEYWORD_CAP = 40;
const SEMANTIC_WEIGHT = 0.6;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IngestResult {
  runId: string;
  queries: string[];
  found: number;
  created: number;
  updated: number;
  closed: number;
  scored: number;
  errors: string[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Stable 0-100 fit: semantic similarity blended with the keyword score. Without
 * an embedding there is no score (null): a keyword-only number is not comparable
 * — a long posting naming many skills saturates it — and the next run retries
 * the embedding.
 */
export function computeMatchScore(keywordScore: number, semanticScore: number | null): number | null {
  if (semanticScore === null) return null;
  const keyword = clamp01(keywordScore / KEYWORD_CAP);
  const semantic = clamp01((semanticScore - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR));
  return Math.round((SEMANTIC_WEIGHT * semantic + (1 - SEMANTIC_WEIGHT) * keyword) * 100);
}

/** First career-preference deal-breaker mentioned by the posting, if any. */
export function findDealBreaker(job: JobListing, resume: ResumeData): string | null {
  const text = `${job.title} ${job.description || ''} ${job.tags?.join(' ') || ''}`.toLowerCase();
  for (const term of resume.preferences?.dealBreakers || []) {
    const needle = term.trim().toLowerCase();
    if (needle && text.includes(needle)) return term.trim();
  }
  return null;
}

/** Role preferences first, then the resume-derived queries smart search uses. */
export function buildIngestQueries(resume: ResumeData): string[] {
  const roles = (resume.preferences?.targetRoles || []).map((role) => role.trim()).filter(Boolean);
  const generated = generateSearchQueries(extractKeywordsFromResume(resume), 'pt');
  const unique = new Set([...roles, ...generated].map((query) => query.toLowerCase()));
  return Array.from(unique).slice(0, MAX_QUERIES);
}

export function profileHash(resume: ResumeData): string {
  return createHash('sha256')
    .update(`v${SCORING_VERSION}|${EMBED_MODEL}|${profileText(resume)}|${JSON.stringify(resume.preferences || {})}`)
    .digest('hex');
}

/** A crashed run (no finishedAt past the timeout) does not count as running. */
export async function isIngestRunning(now = new Date()): Promise<boolean> {
  const running = await prisma.jobIngestRun.findFirst({
    where: { finishedAt: null, startedAt: { gt: new Date(now.getTime() - RUN_TIMEOUT_MS) } },
    select: { id: true },
  });
  return !!running;
}

type Collected = JobListing & { allSources: Set<string> };

async function collectListings(queries: string[], errors: Set<string>): Promise<Map<string, Collected>> {
  const byKey = new Map<string, Collected>();
  for (const keyword of queries) {
    try {
      const listings = await searchJobs(
        { keyword, country: INGEST_COUNTRIES, limit: 200, maxAgeDays: MAX_AGE_DAYS },
        'all'
      );
      for (const error of getLastSourceErrors()) errors.add(`${error.source}: ${error.error}`);
      for (const listing of listings) {
        if (!listing.title?.trim() || !listing.url) continue;
        const key = normalizeJobKey(listing);
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, { ...listing, allSources: new Set([listing.source]) });
          continue;
        }
        existing.allSources.add(listing.source);
        if (getCompletenessScore(listing) > getCompletenessScore(existing)) {
          byKey.set(key, { ...listing, allSources: existing.allSources });
        }
      }
    } catch (error) {
      errors.add(`${keyword}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return byKey;
}

async function upsertPostings(collected: Map<string, Collected>, now: Date) {
  const keys = Array.from(collected.keys());
  if (keys.length === 0) return { created: 0, updated: 0 };

  const existing = await prisma.jobPosting.findMany({
    where: { fingerprint: { in: keys } },
    select: { id: true, fingerprint: true, sources: true },
  });
  const existingByKey = new Map(existing.map((row) => [row.fingerprint, row]));

  const fresh = keys.filter((key) => !existingByKey.has(key));
  if (fresh.length) {
    await prisma.jobPosting.createMany({
      data: fresh.map((key) => {
        const job = collected.get(key)!;
        return {
          fingerprint: key,
          externalId: job.id,
          source: job.source,
          sources: Array.from(job.allSources),
          title: cleanHtmlText(job.title),
          company: cleanHtmlText(job.company || '') || 'Unknown',
          companyLogo: job.companyLogo ?? null,
          description: job.description || '',
          url: job.url,
          location: job.location ?? null,
          jobType: job.jobType ?? null,
          salary: job.salary ?? null,
          tags: job.tags || [],
          embedding: [],
          country: job.country ?? null,
          postedAt: job.postedAt ? new Date(job.postedAt) : null,
          firstSeenAt: now,
          lastSeenAt: now,
        };
      }),
      skipDuplicates: true,
    });
  }

  if (existing.length) {
    // Seeing a posting again keeps it open, including one presumed closed.
    await prisma.jobPosting.updateMany({
      where: { id: { in: existing.map((row) => row.id) } },
      data: { lastSeenAt: now, closedAt: null },
    });
    const widened = existing.filter((row) => {
      const sources = collected.get(row.fingerprint)!.allSources;
      return Array.from(sources).some((source) => !row.sources.includes(source));
    });
    for (const row of widened) {
      const sources = new Set([...row.sources, ...Array.from(collected.get(row.fingerprint)!.allSources)]);
      await prisma.jobPosting.update({ where: { id: row.id }, data: { sources: Array.from(sources) } });
    }
  }

  return { created: fresh.length, updated: existing.length };
}

/** Embed new postings and (re)score every open posting whose scores are stale. */
export async function scorePostings(resume: ResumeData): Promise<number> {
  const hash = profileHash(resume);
  const profile = await getProfileEmbedding(resume);
  const where = {
    closedAt: null,
    // embeddingModel is written together with the embedding, so it also finds
    // rows whose embedding column is NULL (isEmpty does not match NULL).
    OR: [
      { profileHash: null },
      { profileHash: { not: hash } },
      ...(profile ? [{ embeddingModel: null }, { embeddingModel: { not: EMBED_MODEL } }] : []),
    ],
  };

  let scored = 0;
  let cursor = '';
  for (;;) {
    const page = await prisma.jobPosting.findMany({
      where: { ...where, id: { gt: cursor } },
      orderBy: { id: 'asc' },
      take: SCORE_PAGE,
      select: {
        id: true, externalId: true, source: true, title: true, company: true, description: true,
        url: true, location: true, tags: true, embedding: true, embeddingModel: true,
      },
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1].id;

    // Reuse stored embeddings unless they came from another model.
    const embeddings = new Map<string, number[]>();
    for (const row of page) {
      if (row.embedding?.length && row.embeddingModel === EMBED_MODEL) embeddings.set(row.id, row.embedding);
    }
    const missing = profile ? page.filter((row) => !embeddings.has(row.id)) : [];
    for (let i = 0; i < missing.length; i += EMBED_BATCH) {
      const batch = missing.slice(i, i + EMBED_BATCH);
      const vectors = await embedTexts(batch.map(jobText));
      if (!vectors || vectors.length !== batch.length) continue;
      batch.forEach((row, index) => embeddings.set(row.id, vectors[index]));
    }

    const now = new Date();
    await prisma.$transaction(
      page.map((row) => {
        const listing: JobListing = {
          id: row.externalId,
          source: row.source as JobListing['source'],
          title: row.title,
          company: row.company,
          description: row.description,
          url: row.url,
          location: row.location ?? undefined,
          tags: row.tags,
        };
        const embedding = embeddings.get(row.id);
        const keywordScore = Math.max(0, calculateResumeMatchScore(listing, resume));
        const semanticScore = profile && embedding ? cosine(profile, embedding) : null;
        return prisma.jobPosting.update({
          where: { id: row.id },
          data: {
            ...(embedding ? { embedding, embeddingModel: EMBED_MODEL } : {}),
            keywordScore,
            semanticScore,
            matchScore: computeMatchScore(keywordScore, semanticScore),
            dealBreaker: findDealBreaker(listing, resume),
            profileHash: hash,
            scoredAt: now,
          },
        });
      })
    );
    scored += page.length;
  }
  return scored;
}

/** One ingestion pass: collect, upsert, close stale postings, score. */
export async function runIngest(): Promise<IngestResult> {
  const run = await prisma.jobIngestRun.create({ data: {} });
  const errors = new Set<string>();
  const result: IngestResult = { runId: run.id, queries: [], found: 0, created: 0, updated: 0, closed: 0, scored: 0, errors: [] };

  try {
    const resume = (await loadFullResumeData()) as unknown as ResumeData;
    result.queries = buildIngestQueries(resume);

    const now = new Date();
    const collected = await collectListings(result.queries, errors);
    result.found = collected.size;
    Object.assign(result, await upsertPostings(collected, now));

    const closed = await prisma.jobPosting.updateMany({
      where: { closedAt: null, lastSeenAt: { lt: new Date(now.getTime() - STALE_DAYS * DAY_MS) } },
      data: { closedAt: now },
    });
    result.closed = closed.count;
    result.scored = await scorePostings(resume);
  } catch (error) {
    errors.add(`ingest: ${error instanceof Error ? error.message : String(error)}`);
  }

  result.errors = Array.from(errors);
  await prisma.jobIngestRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      queries: result.queries,
      found: result.found,
      created: result.created,
      updated: result.updated,
      closed: result.closed,
      scored: result.scored,
      errors: result.errors.length ? JSON.stringify(result.errors) : null,
    },
  });
  return result;
}

// ---- daily digest ----

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : '#';
}

interface DigestJob {
  title: string;
  company: string;
  location: string | null;
  url: string;
  matchScore: number | null;
  salary: string | null;
}

export function digestHtml(jobs: DigestJob[], feedUrl: string): string {
  const items = jobs
    .map((job) => {
      const meta = [job.location, job.salary].filter(Boolean).map((value) => escapeHtml(value!)).join(' · ');
      return `<li style="margin-bottom:12px"><strong style="color:#dc2626">${job.matchScore ?? '—'}</strong> · <a href="${escapeHtml(safeUrl(job.url))}" style="color:#0f172a;font-weight:600;text-decoration:none">${escapeHtml(job.title)}</a> — ${escapeHtml(job.company)}${meta ? `<br><span style="color:#64748b">${meta}</span>` : ''}</li>`;
    })
    .join('');
  return `<div style="font-family:system-ui,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 4px">🎯 ${jobs.length} nova(s) vaga(s) com bom fit</h2>
    <p style="color:#64748b;margin:0 0 16px">Ordenadas pela pontuação de fit (0-100) com o teu currículo.</p>
    <ul style="padding-left:18px">${items}</ul>
    <p><a href="${escapeHtml(feedUrl)}" style="color:#dc2626">Abrir o feed completo</a></p>
  </div>`;
}

export function digestText(jobs: DigestJob[], feedUrl: string): string {
  const lines = jobs.map(
    (job) => `- [${job.matchScore ?? '—'}] ${job.title} — ${job.company}${job.location ? ` (${job.location})` : ''}\n  ${job.url}`
  );
  return `${jobs.length} nova(s) vaga(s) com bom fit:\n\n${lines.join('\n\n')}\n\nFeed: ${feedUrl}`;
}

/** E-mail the best new postings not digested yet; marks the sent ones. */
export async function runDigest(now = new Date()): Promise<{ sent: number; emailed: boolean }> {
  const jobs = await prisma.jobPosting.findMany({
    where: {
      closedAt: null,
      status: 'new',
      dealBreaker: null,
      digestedAt: null,
      firstSeenAt: { gte: new Date(now.getTime() - DIGEST_WINDOW_DAYS * DAY_MS) },
      matchScore: { gte: DIGEST_MIN_SCORE },
    },
    orderBy: { matchScore: 'desc' },
    take: DIGEST_SIZE,
    select: { id: true, title: true, company: true, location: true, url: true, matchScore: true, salary: true },
  });
  if (jobs.length === 0) return { sent: 0, emailed: false };

  const to = process.env.ALERT_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER;
  if (!to) {
    console.warn('[digest] ALERT_EMAIL not configured; skipping.');
    return { sent: 0, emailed: false };
  }

  const feedUrl = `${(process.env.SITE_URL || 'https://portfolio.josefelipedev.com').replace(/\/+$/, '')}/admin/jobs?tab=feed`;
  const emailed = await sendEmail({
    to,
    subject: `🎯 ${jobs.length} nova(s) vaga(s) com bom fit`,
    html: digestHtml(jobs, feedUrl),
    text: digestText(jobs, feedUrl),
  });
  if (emailed) {
    await prisma.jobPosting.updateMany({
      where: { id: { in: jobs.map((job) => job.id) } },
      data: { digestedAt: now },
    });
  }
  return { sent: emailed ? jobs.length : 0, emailed };
}
