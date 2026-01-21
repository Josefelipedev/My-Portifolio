import prisma from '@/lib/prisma';
import AdminPageWrapper from '@/components/admin/AdminPageWrapper';

export default async function AdminPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
  });
  const experiences = await prisma.experience.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return <AdminPageWrapper projects={projects} experiences={experiences} />;
}
