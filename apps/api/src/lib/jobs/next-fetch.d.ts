// The job-source scrapers were written for Next.js, whose fetch accepts a
// non-standard `next: { revalidate, tags }` cache option. Under Node/undici that
// option simply doesn't exist on RequestInit, so we declaration-merge it in as
// an optional no-op to keep the ported source byte-faithful and type-clean.

export {};

declare global {
  interface RequestInit {
    next?: {
      revalidate?: number | false;
      tags?: string[];
    };
  }
}
