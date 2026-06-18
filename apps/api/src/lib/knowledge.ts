// Knowledge-base engine — full port of the web app's src/lib/knowledge.ts.
// Exports the AI-driven ingestion (processKnowledgeSource), the shared
// KNOWLEDGE_TYPES / types, and the pure context builder (buildKnowledgeContext,
// imported by routes/ai.ts). Imports rewired for the API service:
// @/lib/prisma -> ../db, @/lib/claude -> ./claude.

import prisma from '../db';
import { callAIWithTracking } from './claude';

export const KNOWLEDGE_TYPES = [
  'skill',
  'project',
  'experience',
  'achievement',
  'course',
  'certification',
  'language',
  'tool',
  'domain',
  'responsibility',
  'evidence',
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export interface ExtractedKnowledgeItem {
  type: KnowledgeType;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  priority: number;
}

export interface KnowledgeProcessingResult {
  sourceId: string;
  created: number;
  updated: number;
  skipped: number;
  protectedManual: number;
  chunksProcessed: number;
  items: ExtractedKnowledgeItem[];
}

const CHUNK_SIZE = 12000;
const CHUNK_OVERLAP = 600;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeType(type: unknown): KnowledgeType {
  if (typeof type === 'string' && (KNOWLEDGE_TYPES as readonly string[]).includes(type)) {
    return type as KnowledgeType;
  }
  return 'evidence';
}

function validateExtractedItems(value: unknown): ExtractedKnowledgeItem[] {
  const rawItems = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];

  return rawItems
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      const content = typeof record.content === 'string' ? record.content.trim() : '';
      if (!title || !content) return null;

      return {
        type: normalizeType(record.type),
        title: title.slice(0, 180),
        content,
        tags: normalizeTags(record.tags),
        confidence: clamp(record.confidence, 1, 5, 4),
        priority: clamp(record.priority, 0, 10, 3),
      };
    })
    .filter((item): item is ExtractedKnowledgeItem => item !== null)
    .slice(0, 40);
}

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1] || content.match(/\{[\s\S]*\}/)?.[0] || content.match(/\[[\s\S]*\]/)?.[0];
  if (!jsonText) {
    throw new Error('AI response did not include JSON');
  }
  return JSON.parse(jsonText);
}

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(text.length, start + CHUNK_SIZE);
    const paragraphBreak = text.lastIndexOf('\n\n', hardEnd);
    const sentenceBreak = text.lastIndexOf('. ', hardEnd);
    const end = paragraphBreak > start + CHUNK_SIZE * 0.55
      ? paragraphBreak
      : sentenceBreak > start + CHUNK_SIZE * 0.55
        ? sentenceBreak + 1
        : hardEnd;

    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks.filter(Boolean);
}

function makeFingerprint(item: ExtractedKnowledgeItem): string {
  return `${item.type}:${item.title.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

async function extractKnowledgeItemsFromChunk(params: {
  sourceTitle: string | null;
  sourceId: string;
  chunk: string;
  chunkIndex: number;
  chunkCount: number;
  existingItems: Array<{ id: string; type: string; title: string; tags: string | null }>;
}): Promise<ExtractedKnowledgeItem[]> {
  const { sourceTitle, sourceId, chunk, chunkIndex, chunkCount, existingItems } = params;

  const prompt = `You extract private professional knowledge for a job-search CV generator.

Read the new Portuguese or English text chunk and convert it into structured factual items.
These items will be used later to tailor resumes to specific job descriptions.

Rules:
- Use only facts stated in this chunk.
- Do not invent companies, dates, degrees, metrics, tools, or claims.
- Split broad paragraphs into useful atomic facts.
- Prefer concrete evidence: what was built, solved, used, deployed, improved, or learned.
- If an item already appears in the existing list, return the improved version with the same title when possible.
- Write concise professional English content, even if the input is Portuguese.
- Tags should be short keywords useful for matching jobs.

Allowed types:
${KNOWLEDGE_TYPES.join(', ')}

Existing active knowledge titles:
${existingItems.map((item) => `- ${item.type}: ${item.title} (${item.tags || 'no tags'})`).join('\n') || '- none'}

New text source title: ${sourceTitle || 'Untitled'}
Chunk: ${chunkIndex + 1} of ${chunkCount}

New text chunk:
${chunk}

Return ONLY JSON:
{
  "items": [
    {
      "type": "skill|project|experience|achievement|course|certification|language|tool|domain|responsibility|evidence",
      "title": "short title",
      "content": "factual content that can safely support a CV bullet or skill claim",
      "tags": ["Next.js", "PostgreSQL"],
      "confidence": 1,
      "priority": 0
    }
  ]
}`;

  const { content } = await callAIWithTracking(prompt, 'knowledge-ingestion', {
    maxTokens: 3000,
    temperature: 0.2,
    metadata: { sourceId, chunkIndex, chunkCount },
  });

  return validateExtractedItems(extractJson(content));
}

export async function processKnowledgeSource(
  sourceId: string
): Promise<KnowledgeProcessingResult> {
  const source = await prisma.knowledgeSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) throw new Error('Knowledge source not found');

  const existingItems = await prisma.knowledgeItem.findMany({
    where: { isActive: true },
    select: { id: true, type: true, title: true, tags: true, source: true },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  });

  const chunks = chunkText(source.rawText);
  const extractedByFingerprint = new Map<string, ExtractedKnowledgeItem>();

  for (let index = 0; index < chunks.length; index++) {
    const chunkItems = await extractKnowledgeItemsFromChunk({
      sourceTitle: source.title,
      sourceId,
      chunk: chunks[index],
      chunkIndex: index,
      chunkCount: chunks.length,
      existingItems,
    });

    for (const item of chunkItems) {
      const fingerprint = makeFingerprint(item);
      const existing = extractedByFingerprint.get(fingerprint);
      if (!existing || item.content.length > existing.content.length) {
        extractedByFingerprint.set(fingerprint, item);
      }
    }
  }

  const items = Array.from(extractedByFingerprint.values()).slice(0, 120);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let protectedManual = 0;

  for (const item of items) {
    const existing = await prisma.knowledgeItem.findFirst({
      where: {
        type: item.type,
        title: {
          equals: item.title,
          mode: 'insensitive',
        },
      },
    });

    const data = {
      type: item.type,
      title: item.title,
      content: item.content,
      tags: item.tags.join(','),
      source: 'ai_text',
      sourceId,
      confidence: item.confidence,
      priority: item.priority,
      isActive: true,
    };

    if (existing) {
      if (existing.source === 'manual' || existing.source === 'admin') {
        protectedManual++;
        skipped++;
      } else {
        await prisma.knowledgeItem.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      }
    } else if (item.content.length > 20) {
      await prisma.knowledgeItem.create({ data });
      created++;
    } else {
      skipped++;
    }
  }

  await prisma.knowledgeSource.update({
    where: { id: sourceId },
    data: { processedAt: new Date() },
  });

  return {
    sourceId,
    created,
    updated,
    skipped,
    protectedManual,
    chunksProcessed: chunks.length,
    items,
  };
}

export function buildKnowledgeContext(
  items: Array<{
    type: string;
    title: string;
    content: string;
    tags: string | null;
    confidence: number;
    priority: number;
  }>,
): string {
  if (items.length === 0) return 'No private knowledge items available.';

  return items
    .map((item) => {
      const tags = item.tags ? ` Tags: ${item.tags}.` : '';
      return `- [${item.type}] ${item.title}: ${item.content}${tags} Confidence: ${item.confidence}/5.`;
    })
    .join('\n');
}
