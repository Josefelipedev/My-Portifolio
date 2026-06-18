import AdminPageWrapper from '@/components/admin/AdminPageWrapper';
import { serverApiFetch } from '@/lib/server-api';
import type { Project, Experience } from '@portfolio/shared';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [projects, experiences] = await Promise.all([
    serverApiFetch<Project[]>('/api/projects'),
    serverApiFetch<Experience[]>('/api/experiences'),
  ]);
  // API returns ISO-string dates; the wrapper components accept the data shape.
  return <AdminPageWrapper projects={projects as never} experiences={experiences as never} />;
}
