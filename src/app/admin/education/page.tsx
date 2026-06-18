import AdminLayout from '@/components/admin/AdminLayout';
import EducationAdmin from '@/components/admin/EducationAdmin';
import { serverApiFetch } from '@/lib/server-api';
import type { Education } from '@portfolio/shared';

export const dynamic = 'force-dynamic';

async function getEducation(): Promise<Education[]> {
  try {
    return await serverApiFetch<Education[]>('/api/education');
  } catch (error) {
    console.error('[AdminEducation] Error fetching education:', error);
    return [];
  }
}

export default async function EducationAdminPage() {
  const education = await getEducation();
  return (
    <AdminLayout title="Education Management" subtitle="Manage your degrees, courses, and certifications">
      <EducationAdmin education={education as never} />
    </AdminLayout>
  );
}
