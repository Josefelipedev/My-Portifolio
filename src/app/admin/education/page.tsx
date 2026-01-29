import AdminLayout from '@/components/admin/AdminLayout';
import EducationAdmin from '@/components/admin/EducationAdmin';
import prisma from '@/lib/prisma';

async function getEducation() {
  try {
    const education = await prisma.education.findMany({
      orderBy: [{ startDate: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });
    return education;
  } catch {
    // Table might not exist yet
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
