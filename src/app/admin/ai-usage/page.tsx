import Link from 'next/link';
import AIUsageStats from '@/components/admin/AIUsageStats';

export const metadata = {
  title: 'AI Usage - Admin',
  description: 'Monitor AI API usage and costs',
};

export default function AIUsagePage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI Usage Monitor</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Track Together AI costs and usage</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Admin
            </Link>
          </div>
        </div>

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
      </div>
    </main>
  );
}
