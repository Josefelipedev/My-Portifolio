import { isAuthenticated } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AnalyticsPageWrapper from '@/components/admin/AnalyticsPageWrapper';
import AnalyticsClient from './AnalyticsClient';
import { serverApiFetch } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  if (!(await isAuthenticated())) {
    redirect('/admin/login');
  }
  const data = await serverApiFetch('/api/analytics');
  return (
    <AnalyticsPageWrapper data={data as never}>
      <AnalyticsClient data={data as never} />
    </AnalyticsPageWrapper>
  );
}
