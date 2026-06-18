// Knowledge-base helper ported from the web app's src/lib/knowledge.ts. Only
// the pure context builder is needed by the AI routes here; the AI-driven
// ingestion (processKnowledgeSource) stays with the admin/knowledge domain.

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
