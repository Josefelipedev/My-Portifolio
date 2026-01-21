'use client';

import React from 'react';
import AdminLayout from './AdminLayout';

interface SkillsPageWrapperProps {
  children: React.ReactNode;
}

export default function SkillsPageWrapper({ children }: SkillsPageWrapperProps) {
  return (
    <AdminLayout
      title="Skills Management"
      subtitle="Manage your technical skills and get AI suggestions"
    >
      {children}
    </AdminLayout>
  );
}
