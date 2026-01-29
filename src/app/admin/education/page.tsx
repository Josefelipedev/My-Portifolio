import AdminLayout from '@/components/admin/AdminLayout';
import EducationAdmin from '@/components/admin/EducationAdmin';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getEducation() {
  try {
    const education = await prisma.education.findMany({
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });
    console.log('[AdminEducation] Found', education.length, 'education entries');
    return education;
  } catch (error) {
    console.error('[AdminEducation] Error fetching education:', error);
    return [];
  }
}

export default async function EducationAdminPage() {
  const education = await getEducation();

  return (
    <AdminLayout
      title="Education Management"
      subtitle="Manage your degrees, courses, and certifications"
    >
      <EducationAdmin education={education} />
    </AdminLayout>
  );
}
