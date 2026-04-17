'use client';

import { useState } from 'react';
import { type CustomCVContent, buildCVHtml } from '@/lib/jobs/cv-html';
import resumeData from '@/data/resume.json';

interface Job {
  id: string;
  title: string;
  company: string;
  generatedCvAt?: string;
}

interface CVGeneratorButtonProps {
  job: Job;
  onGenerated?: () => void;
}

export default function CVGeneratorButton({ job, onGenerated }: CVGeneratorButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch(`/api/jobs/saved/${job.id}/generate-cv`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate CV');
      }

      const customCV = data.customCV as CustomCVContent;

      // Build HTML and trigger PDF download
      const html = buildCVHtml(
        customCV,
        resumeData.personalInfo,
        job.title,
        job.company
      );

      // Dynamic import of html2pdf.js (client-side only)
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;

      const element = document.createElement('div');
      element.innerHTML = html;
      document.body.appendChild(element);

      await html2pdf()
        .set({
          margin: 0,
          filename: `cv-${job.company.toLowerCase().replace(/\s+/g, '-')}-${job.title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();

      document.body.removeChild(element);
      onGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate CV');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors flex items-center gap-1"
        title={job.generatedCvAt ? 'Regenerate tailored CV PDF' : 'Generate tailored CV PDF for this job'}
      >
        {generating ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Gerando CV...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {job.generatedCvAt ? 'Regen CV' : 'Gerar CV'}
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
