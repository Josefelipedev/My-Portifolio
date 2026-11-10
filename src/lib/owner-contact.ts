import resumeData from '@/data/resume.json';
import { apiFetch } from '@/lib/api-fetch';

export type PersonalInfo = typeof resumeData.personalInfo;

/**
 * The phone and home address are not bundled: the repo and the site's JS are
 * public. The API returns them to the signed-in owner, so CV PDFs load them
 * first and fall back to the public fields when the request fails.
 */
export async function loadOwnerPersonalInfo(): Promise<PersonalInfo> {
  try {
    const response = await apiFetch('/api/resume?section=personal');
    if (response.ok) {
      const data = (await response.json()) as { personalInfo?: Partial<PersonalInfo> };
      if (data.personalInfo) return { ...resumeData.personalInfo, ...data.personalInfo };
    }
  } catch {
    // Offline or API down: render the CV with the public fields only.
  }
  return resumeData.personalInfo;
}
