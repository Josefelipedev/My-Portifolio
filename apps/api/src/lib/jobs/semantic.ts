// Semantic re-ranking — embeds the candidate's profile and the job listings with
// a multilingual embedding model (Together) and re-orders results by cosine
// similarity blended with the existing keyword score. Degrades gracefully: any
// failure (no API key, model error) leaves the input ordering untouched.

import Together from 'together-ai';
import { createHash } from 'node:crypto';
import type { JobListing, ResumeData } from './types';

// Serverless multilingual model (PT + EN). Overridable via env.
const EMBED_MODEL = process.env.TOGETHER_EMBED_MODEL || 'intfloat/multilingual-e5-large-instruct';
// e5-instruct wants an instruction prefix on the query side; documents stay plain.
const QUERY_INSTRUCT =
  'Instruct: Given a tech professional profile, retrieve job postings that best match their skills and experience.\nQuery: ';
// Only the strongest keyword-ranked head is re-embedded, to bound cost/latency.
const RERANK_HEAD = 100;

function getClient(): Together | null {
  const apiKey = process.env.TOGETHER_API_KEY;
  return apiKey ? new Together({ apiKey }) : null;
}

async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const client = getClient();
  if (!client || texts.length === 0) return null;
  try {
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

function profileText(resume: ResumeData): string {
  const skills = resume.skills?.map((s) => s.name).join(', ') || '';
  const exp =
    resume.experience
      ?.map((e) => `${e.title} at ${e.company}: ${(e.responsibilities || []).join('; ')}`)
      .join('\n') || '';
  const certs = resume.certifications?.map((c) => c.name).join(', ') || '';
  return `Skills: ${skills}\nExperience:\n${exp}\nCertifications: ${certs}`.trim();
}

function jobText(job: JobListing): string {
  const tags = Array.isArray(job.tags) ? job.tags.join(', ') : '';
  return `${job.title} at ${job.company}. ${tags}. ${(job.description || '').slice(0, 600)}`.trim();
}

// The profile embedding rarely changes, so cache it keyed by a content hash.
let profileCache: { key: string; embedding: number[] } | null = null;

async function getProfileEmbedding(resume: ResumeData): Promise<number[] | null> {
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
 * input unchanged on any failure. Only the top RERANK_HEAD are re-embedded.
 */
export async function applySemanticRerank(
  jobs: JobListing[],
  resume: ResumeData
): Promise<JobListing[]> {
  if (process.env.JOBS_SEMANTIC_RERANK === 'false' || jobs.length < 2) return jobs;

  const head = jobs.slice(0, RERANK_HEAD);
  const tail = jobs.slice(RERANK_HEAD);

  const [profile, jobEmbeddings] = await Promise.all([
    getProfileEmbedding(resume),
    embedTexts(head.map(jobText)),
  ]);
  if (!profile || !jobEmbeddings || jobEmbeddings.length !== head.length) return jobs;

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
