// Public books routes — ported from the web app's src/app/api/books/route.ts
// GET handler. Query logic and ordering are kept identical; the response
// matches the @portfolio/shared contract.
//
// Phase 2 (auth pending): port POST /api/books (src/app/api/books/route.ts)
// Phase 2 (auth pending): port PUT /api/books/:id (src/app/api/books/[id]/route.ts)
// Phase 2 (auth pending): port DELETE /api/books/:id (src/app/api/books/[id]/route.ts)
// Phase 2 (auth pending): port POST /api/books/import (src/app/api/books/import/route.ts)
// The [id] route exposes no public GET, so nothing there is ported yet.

import { Hono } from 'hono';
import prisma from '../db';

const books = new Hono();

// Mirrors withCacheHeaders(res, 60, 300) from the web api-utils.
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

books.get('/books', async (c) => {
  const list = await prisma.book.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  });
  c.header('Cache-Control', CACHE_CONTROL);
  return c.json(list);
});

export default books;
