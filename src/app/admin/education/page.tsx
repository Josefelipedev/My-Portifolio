import AdminLayout from '@/components/admin/AdminLayout';
import EducationAdmin from '@/components/admin/EducationAdmin';
import prisma from '@/lib/prisma';

async function getEducation() {
  const education = await prisma.education.findMany({
    orderBy: [{ startDate: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }],
  });
  return education;
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
