import JobsPageWrapper from '@/components/admin/JobsPageWrapper';
import { serverApiFetch } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

interface StatsResp {
  savedJobs: number;
  applications: { saved: number; applied: number; interview: number; offer: number; rejected: number; total: number };
}

export default async function JobsAdminPage() {
  let savedJobsCount = 0;
  let totalApplications = 0;
  let statsMap: Record<string, number> = {};
  let error: string | null = null;
  try {
    const s = await serverApiFetch<StatsResp>('/api/jobs/stats');
    savedJobsCount = s.savedJobs;
    const { total, ...rest } = s.applications;
    statsMap = rest;
    totalApplications = total;
  } catch {
    error = 'Failed to load job stats from the API.';
  }
  return (
    <JobsPageWrapper savedJobsCount={savedJobsCount} totalApplications={totalApplications} statsMap={statsMap} error={error} />
  );
}
