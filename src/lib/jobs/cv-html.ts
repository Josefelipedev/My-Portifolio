// Client-safe CV HTML builder — no server imports
// Used by CVGeneratorButton (client component) to render the CV for PDF export

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
}

interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
}

/**
 * Build an ATS-friendly HTML string from CV content (used by html2pdf.js on the client)
 */
export function buildCVHtml(
  cv: CustomCVContent,
  personalInfo: PersonalInfo,
  jobTitle: string,
  company: string
): string {
  const skillsHtml = cv.skills
    .map((s) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;background:#f1f5f9;border-radius:3px;font-size:11px;">${s}</span>`)
    .join('');

  const expHtml = cv.experience
    .map(
      (e) => `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <strong style="font-size:13px;">${e.title}</strong>
          <span style="font-size:11px;color:#64748b;">${e.startDate} – ${e.endDate}</span>
        </div>
        <div style="font-size:12px;color:#475569;margin-bottom:4px;">${e.company}${e.location ? ` · ${e.location}` : ''}</div>
        <ul style="margin:4px 0 0 16px;padding:0;">
          ${e.bullets.map((b) => `<li style="font-size:12px;margin-bottom:3px;color:#334155;">${b}</li>`).join('')}
        </ul>
      </div>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 32px; color: #1e293b; }
  h1 { margin: 0; font-size: 22px; color: #0f172a; }
  h2 { margin: 20px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .contact { font-size: 11px; color: #64748b; margin: 4px 0 0; }
  .target { font-size: 11px; color: #3b82f6; margin: 4px 0 0; }
  p { margin: 0; font-size: 12px; line-height: 1.6; color: #334155; }
</style>
</head>
<body>
  <h1>${personalInfo.name}</h1>
  <div class="contact">${personalInfo.email} · ${personalInfo.phone} · linkedin.com/in/${personalInfo.linkedin} · github.com/${personalInfo.github}</div>
  <div class="target">Tailored for: ${jobTitle} @ ${company}</div>

  <h2>Professional Summary</h2>
  <p>${cv.summary}</p>

  <h2>Skills</h2>
  <div>${skillsHtml}</div>

  <h2>Experience</h2>
  ${expHtml}
</body>
</html>`;
}
