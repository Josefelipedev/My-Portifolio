import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import SavedJobs from '@/components/admin/SavedJobs';

const jobWithKnowledge = {
  id: 'job-1', externalId: 'ext-1', source: 'test',
  title: 'Senior React Developer', company: 'ZZTestCorp',
  description: 'React + AWS role', url: 'https://example.com', location: 'Remote',
  jobType: 'Full-time', tags: 'React,AWS', savedAt: new Date().toISOString(),
  generatedCvAt: new Date().toISOString(),
  enrichedData: JSON.stringify({
    customizedCv: {
      providedKnowledge: [
        { id: 'k1', title: 'React dashboard', type: 'project' },
        { id: 'k2', title: 'AWS ECS deploys', type: 'tool' },
      ],
    },
  }),
};

beforeEach(() => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('/api/jobs/saved')) {
      return { ok: true, status: 200, json: async () => ({ jobs: [jobWithKnowledge], total: 1, hasMore: false, totalCount: 1 }) } as any;
    }
    return { ok: true, status: 200, json: async () => ({}) } as any;
  }) as any;
});

describe('SavedJobs — providedKnowledge block', () => {
  it('renders the knowledge facts used in the tailored CV when expanded', async () => {
    render(
      <ToastProvider>
        <ConfirmProvider>
          <SavedJobs onJobRemoved={() => {}} onApplicationCreated={() => {}} />
        </ConfirmProvider>
      </ToastProvider>
    );

    // Wait for the job card to load
    await waitFor(() => expect(screen.getByText('Senior React Developer')).toBeTruthy());

    // Expand the card (Show more) to reveal enriched + knowledge sections
    fireEvent.click(screen.getByText('Show more'));

    await waitFor(() => {
      expect(screen.getByText(/Knowledge used in tailored CV \(2\)/)).toBeTruthy();
    });
    expect(screen.getByText('React dashboard')).toBeTruthy();
    expect(screen.getByText('AWS ECS deploys')).toBeTruthy();
  });
});
