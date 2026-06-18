// Typed client for the public portfolio content endpoints.
//
// One method per endpoint, each bound to its response schema. This is what
// the web frontend (apps/web) calls instead of touching Prisma directly —
// the conversion target for the RSC pages in Phase 4.

import { HttpClient, type HttpClientOptions } from './http';
import {
  projectListSchema,
  experienceListSchema,
  educationListSchema,
  skillListSchema,
  siteConfigResponseSchema,
  type Project,
  type Experience,
  type Education,
  type Skill,
  type PublicSiteConfig,
} from './schemas';

export class PortfolioApi {
  constructor(private readonly http: HttpClient) {}

  /** GET /api/projects — public projects, ordered by rank/featured/date. */
  listProjects(): Promise<Project[]> {
    return this.http.get('/api/projects', projectListSchema);
  }

  /** GET /api/experiences — work experience entries. */
  listExperiences(): Promise<Experience[]> {
    return this.http.get('/api/experiences', experienceListSchema);
  }

  /** GET /api/education — visible education/courses/certifications. */
  listEducation(): Promise<Education[]> {
    return this.http.get('/api/education', educationListSchema);
  }

  /** GET /api/skills — skills grouped by category. */
  listSkills(): Promise<Skill[]> {
    return this.http.get('/api/skills', skillListSchema);
  }

  /** GET /api/profile — public site configuration (no secrets), unwrapped. */
  async getSiteConfig(): Promise<PublicSiteConfig | null> {
    const res = await this.http.get('/api/profile', siteConfigResponseSchema);
    return res.data;
  }
}

/** Convenience factory: build a PortfolioApi from client options. */
export function createPortfolioApi(opts: HttpClientOptions): PortfolioApi {
  return new PortfolioApi(new HttpClient(opts));
}
