// Shared job-related types used by the admin frontend.
// The runtime CV generation lives in the standalone API (apps/api); the web
// app only needs the shape of the generated CV content for rendering.

export interface CustomCVContent {
  summary: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    location: string;
    bullets: string[];
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
    link?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: string;
  }>;
  providedKnowledge?: Array<{
    id: string;
    title: string;
    type: string;
  }>;
}
