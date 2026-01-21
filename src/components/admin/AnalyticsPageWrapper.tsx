'use client';

import React from 'react';
import AdminLayout from './AdminLayout';

interface AnalyticsData {
  overview: {
    totalVisits: number;
    uniqueVisits: number;
    todayVisits: number;
    todayUnique: number;
  };
  visitsByDay: Array<{ date: string; count: number }>;
  devices: Array<{ name: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  operatingSystems: Array<{ name: string; count: number }>;
  topReferrers: Array<{ url: string; count: number }>;
  topPages: Array<{ page: string; count: number }>;
  recentVisits: Array<{
    id: string;
    visitorId: string;
    page: string;
    referrer: string | null;
    ipAddress: string | null;
    device: string | null;
    browser: string | null;
    os: string | null;
    createdAt: string;
  }>;
}

interface AnalyticsPageWrapperProps {
  data: AnalyticsData;
  children: React.ReactNode;
}

export default function AnalyticsPageWrapper({ children }: AnalyticsPageWrapperProps) {
  return (
    <AdminLayout
      title="Analytics"
      subtitle="Site visitor statistics"
    >
      {children}
    </AdminLayout>
  );
}
