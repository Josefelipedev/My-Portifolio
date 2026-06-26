// CLI: follow a company so the portal scan tracks all of its jobs.
//
//   npm run follow:company -- "<Company Name>" "<careersUrl>" [--location=pt,porto] [--slug=x] [--type=greenhouse]
//
// Examples:
//   npm run follow:company -- "Cleverti" "https://jobs.lever.co/cleverti" --location=portugal,lisbon,porto
//   npm run follow:company -- "Some Co" "https://jobs.smartrecruiters.com/SomeCo"
//
// Validates the ATS live (must return >=1 matching job) before saving, then adds
// it as an ACTIVE CompanyPortal. Idempotent by careers URL.

import { followCompany } from '../lib/jobs/follow-company';

function flag(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  return a ? a.slice(pref.length) : undefined;
}

(async () => {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const [company, careersUrl] = positional;

  if (!company || !careersUrl) {
    console.error('Usage: npm run follow:company -- "<Company>" "<careersUrl>" [--location=pt,porto] [--slug=x] [--type=greenhouse] [--force]');
    process.exit(1);
  }

  const location = flag('location')?.split(',').map((s) => s.trim()).filter(Boolean);
  const r = await followCompany({
    company,
    careersUrl,
    location,
    portalType: flag('type'),
    portalSlug: flag('slug'),
    force: process.argv.includes('--force'),
  });

  if (r.ok) {
    const future = r.jobs === 0 ? ' (0 IT jobs now — tracking for future postings)' : '';
    console.log(`✅ Following ${r.company} [${r.portalType}] — ${r.action}, ${r.jobs} matching job(s)${future}. It will be scanned from now on.`);
  } else {
    console.error(`❌ Could not follow ${r.company} [${r.portalType ?? '?'}]: ${r.reason}`);
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('[follow:company] failed:', e);
  process.exit(1);
});
