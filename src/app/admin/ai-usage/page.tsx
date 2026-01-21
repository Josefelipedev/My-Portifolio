'use client';

import AIUsageStats from '@/components/admin/AIUsageStats';
import AdminLayout from '@/components/admin/AdminLayout';

export default function AIUsagePage() {
  return (
    <AdminLayout
      title="AI Usage Monitor"
      subtitle="Track Together AI costs and usage"
    >
      {/* Stats Component */}
      <AIUsageStats />

      {/* Info Card */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">About Together AI Pricing</h3>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Current model: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">meta-llama/Llama-3.3-70B-Instruct-Turbo</code>
        </p>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-blue-600 dark:text-blue-400">
          <div>
            <span className="font-medium">Input:</span> $0.88 / 1M tokens
          </div>
          <div>
            <span className="font-medium">Output:</span> $0.88 / 1M tokens
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-500 dark:text-blue-500">
          Costs are tracked automatically for all Together AI calls. Quota limits help prevent unexpected charges.
        </p>
      </div>
    </AdminLayout>
  );
}
