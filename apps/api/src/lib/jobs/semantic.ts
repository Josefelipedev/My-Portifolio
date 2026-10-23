// Semantic re-ranking — embeds the candidate's profile and the job listings with
// a multilingual embedding model and re-orders results by cosine similarity
// blended with the existing keyword score. Degrades gracefully: any failure (no
// provider, model error) leaves the input ordering untouched.

import Together from 'together-ai';
import { createHash } from 'node:crypto';
import prisma from '../../db';
import { normalizeJobKey } from './deduplication';
import { cleanHtmlText } from './helpers';
import type { JobListing, ResumeData } from './types';

// Together withdrew multilingual-e5-large-instruct from serverless in 2026 (its
// only serverless embedder left is English-only), so the default is a local
// Ollama model: qwen3-embedding:0.6b ranked PT/EN postings best of the
// candidates tried. EMBED_PROVIDER=together keeps the hosted path available.
export const EMBED_PROVIDER = process.env.EMBED_PROVIDER || (process.env.OLLAMA_URL ? 'ollama' : 'together');
export const EMBED_MODEL =
  EMBED_PROVIDER === 'ollama'
    ? process.env.OLLAMA_EMBED_MODEL || 'qwen3-embedding:0.6b'
    : process.env.TOGETHER_EMBED_MODEL || 'intfloat/multilingual-e5-large-instruct';
// qwen3-embedding and e5-instruct want an instruction prefix on the query side;
// documents stay plain.
const QUERY_INSTRUCT =
  'Instruct: Given a tech professional profile, retrieve job postings that best match their skills and experience.\nQuery: ';
// Only the strongest keyword-ranked head is re-embedded, to bound cost/latency.
const RERANK_HEAD = 100;
// CPU-only Ollama on a loaded VPS can take minutes per batch.
const OLLAMA_TIMEOUT_MS = 300_000;

function getClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  return apiKey ? new Together({ apiKey }) : null;
}

async function embedWithOllama(texts: string[]): Promise<number[][]> {
  const base = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { embeddings?: number[][] };
  if (!data.embeddings || data.embeddings.length !== texts.length) throw new Error('Ollama returned no embeddings');
  return data.embeddings;
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return null;
  try {
    if (EMBED_PROVIDER === 'ollama') return await embedWithOllama(texts);
    const client = getClient();
    if (!client) return null;
    const res = await client.embeddings.create({ model: EMBED_MODEL, input: texts });
    const sorted = [...res.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return sorted.map((d) => d.embedding as number[]);
  } catch (e) {
    console.warn('[semantic] embedding failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function profileText(resume: ResumeData): string {
  const skills = resume.skills?.map((s) => s.name).join(', ') || '';
  const exp =
    resume.experience
      ?.map((e) => `${e.title} at ${e.company}: ${(e.responsibilities || []).join('; ')}`)
      .join('\n') || '';
  const certs = resume.certifications?.map((c) => c.name).join(', ') || '';
  return `Skills: ${skills}\nExperience:\n${exp}\nCertifications: ${certs}`.trim();
}

/** The document text embedded for a posting (feed ingestion and re-rank alike). */
export function jobText(job: { title: string; company: string; location?: string | null; tags?: string[]; description: string }): string {
  const tags = job.tags?.length ? `${job.tags.join(', ')}. ` : '';
  const location = job.location ? ` (${job.location})` : '';
  return `${job.title} at ${job.company}${location}. ${tags}${cleanHtmlText(job.description || '').slice(0, 1500)}`.trim();
}

// Postings the feed already embedded (same fingerprint and model) need no new
// embedding call — on CPU-only Ollama that is the difference between an
// instant and a slow interactive search.
async function storedEmbeddings(jobs: JobListing[]): Promise<Map<string, number[]>> {
  try {
    const rows = await prisma.jobPosting.findMany({
      where: { fingerprint: { in: jobs.map(normalizeJobKey) }, embeddingModel: EMBED_MODEL },
      select: { fingerprint: true, embedding: true },
    });
    return new Map(rows.filter((row) => row.embedding?.length).map((row) => [row.fingerprint, row.embedding]));
  } catch {
    return new Map();
  }
}

// The profile embedding rarely changes, so cache it keyed by a content hash.
let profileCache: { key: string; embedding: number[] } | null = null;

export async function getProfileEmbedding(resume: ResumeData): Promise<number[] | null> {
  const text = profileText(resume);
  const key = createHash('sha256').update(`${EMBED_MODEL}|${text}`).digest('hex');
  if (profileCache?.key === key) return profileCache.embedding;
  const emb = await embedTexts([QUERY_INSTRUCT + text]);
  if (!emb) return null;
  profileCache = { key, embedding: emb[0] };
  return emb[0];
}

/**
 * Re-rank keyword-scored jobs by semantic similarity to the resume. Blends
 * cosine similarity (0.6) with the normalized keyword score (0.4). Returns the
 * input unchanged on any failure. Only the top RERANK_HEAD are embedded, and
 * only those the feed has not embedded already.
 */
export async function applySemanticRerank(
  jobs: JobListing[],
  resume: ResumeData
): Promise<JobListing[]> {
  if (process.env.JOBS_SEMANTIC_RERANK === 'false' || jobs.length < 2) return jobs;

  const head = jobs.slice(0, RERANK_HEAD);
  const tail = jobs.slice(RERANK_HEAD);

  const stored = await storedEmbeddings(head);
  const missing = head.filter((job) => !stored.has(normalizeJobKey(job)));
  const [profile, fresh] = await Promise.all([
    getProfileEmbedding(resume),
    missing.length ? embedTexts(missing.map(jobText)) : Promise.resolve([] as number[][]),
  ]);
  if (!profile || !fresh || fresh.length !== missing.length) return jobs;
  missing.forEach((job, i) => stored.set(normalizeJobKey(job), fresh[i]));
  const jobEmbeddings = head.map((job) => stored.get(normalizeJobKey(job))!);

  const scores = head.map((j) => j.relevanceScore ?? 0);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const norm = (v: number) => (maxS > minS ? (v - minS) / (maxS - minS) : 0.5);

  const ranked = head.map((job, i) => {
    const semantic = cosine(profile, jobEmbeddings[i]);
    const combined = 0.6 * semantic + 0.4 * norm(job.relevanceScore ?? 0);
    return { ...job, semanticScore: semantic, combinedScore: combined };
  });
  ranked.sort((a, b) => b.combinedScore - a.combinedScore);

  return [...ranked.map(({ combinedScore: _c, ...job }) => job), ...tail];
}
