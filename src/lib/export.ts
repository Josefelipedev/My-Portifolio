import Papa from 'papaparse';

// Type definitions for export data
export interface ExportableJob {
  title: string;
  company: string;
  location?: string;
  salary?: string;
  url?: string;
  source?: string;
  tags?: string;
  savedAt?: string;
}

export interface ExportableApplication {
  title: string;
  company: string;
  location?: string;
  salary?: string;
  url?: string;
  status: string;
  appliedAt?: string;
  notes?: string;
  nextStep?: string;
  nextStepDate?: string;
  createdAt: string;
}

/**
 * Export data to CSV and trigger download
 */
export function exportToCSV<T>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
): void {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  let csvData: string;

  if (columns) {
    // Use specified columns with custom labels
    const headers = columns.map((col) => col.label);
    const rows = data.map((item) =>
      columns.map((col) => {
        const value = item[col.key];
        return value !== null && value !== undefined ? String(value) : '';
      })
    );
    csvData = Papa.unparse({ fields: headers, data: rows });
  } else {
    // Auto-detect columns from data - cast to unknown[] for Papa
    csvData = Papa.unparse(data as unknown[]);
  }

  // Create blob and trigger download
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to PDF (uses html2pdf.js dynamically loaded)
 */
export async function exportToPDF(
  element: HTMLElement | string,
  filename: string
): Promise<void> {
  // Dynamically import html2pdf to avoid SSR issues
  const html2pdf = (await import('html2pdf.js')).default;

  const pdfOptions = {
    margin: 10,
    filename: `${filename}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
  };

  let targetElement: HTMLElement;

  if (typeof element === 'string') {
    // If string, create a temporary element with the HTML content
    targetElement = document.createElement('div');
    targetElement.innerHTML = element;
    targetElement.style.padding = '20px';
    targetElement.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(targetElement);

    try {
      await html2pdf().set(pdfOptions).from(targetElement).save();
    } finally {
      document.body.removeChild(targetElement);
    }
  } else {
    await html2pdf().set(pdfOptions).from(element).save();
  }
}

/**
 * Generate HTML report for saved jobs
 */
export function generateJobsReportHTML(jobs: ExportableJob[], title: string = 'Saved Jobs Report'): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const jobsHTML = jobs
    .map(
      (job) => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">${job.title}</h3>
      <p style="margin: 0 0 4px 0; color: #4b5563; font-size: 14px;">${job.company}</p>
      ${job.location ? `<p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px;">Location: ${job.location}</p>` : ''}
      ${job.salary ? `<p style="margin: 0 0 4px 0; color: #059669; font-size: 12px;">Salary: ${job.salary}</p>` : ''}
      ${job.source ? `<p style="margin: 0; color: #9ca3af; font-size: 11px;">Source: ${job.source}</p>` : ''}
    </div>
  `
    )
    .join('');

  return `
    <div style="max-width: 800px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
        <h1 style="margin: 0 0 8px 0; color: #111827; font-size: 24px;">${title}</h1>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Generated on ${date}</p>
        <p style="margin: 8px 0 0 0; color: #4b5563; font-size: 14px;">Total Jobs: ${jobs.length}</p>
      </div>
      ${jobsHTML}
    </div>
  `;
}

/**
 * Generate HTML report for applications
 */
export function generateApplicationsReportHTML(
  applications: ExportableApplication[],
  title: string = 'Job Applications Report'
): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statusColors: Record<string, string> = {
    saved: '#6b7280',
    applied: '#3b82f6',
    interview: '#f59e0b',
    offer: '#10b981',
    rejected: '#ef4444',
  };

  // Group by status
  const byStatus = applications.reduce((acc, app) => {
    if (!acc[app.status]) acc[app.status] = [];
    acc[app.status].push(app);
    return acc;
  }, {} as Record<string, ExportableApplication[]>);

  const statusSummary = Object.entries(byStatus)
    .map(
      ([status, apps]) => `
    <span style="display: inline-block; margin-right: 16px; padding: 4px 12px; background: ${statusColors[status] || '#6b7280'}20; color: ${statusColors[status] || '#6b7280'}; border-radius: 4px; font-size: 13px;">
      ${status.charAt(0).toUpperCase() + status.slice(1)}: ${apps.length}
    </span>
  `
    )
    .join('');

  const applicationsHTML = applications
    .map(
      (app) => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">${app.title}</h3>
          <p style="margin: 0 0 4px 0; color: #4b5563; font-size: 14px;">${app.company}</p>
        </div>
        <span style="padding: 4px 12px; background: ${statusColors[app.status] || '#6b7280'}20; color: ${statusColors[app.status] || '#6b7280'}; border-radius: 4px; font-size: 12px; font-weight: 500;">
          ${app.status.charAt(0).toUpperCase() + app.status.slice(1)}
        </span>
      </div>
      ${app.location ? `<p style="margin: 8px 0 4px 0; color: #6b7280; font-size: 12px;">Location: ${app.location}</p>` : ''}
      ${app.appliedAt ? `<p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px;">Applied: ${new Date(app.appliedAt).toLocaleDateString()}</p>` : ''}
      ${app.nextStep ? `<p style="margin: 0 0 4px 0; color: #f59e0b; font-size: 12px;">Next: ${app.nextStep}${app.nextStepDate ? ` on ${new Date(app.nextStepDate).toLocaleDateString()}` : ''}</p>` : ''}
      ${app.notes ? `<p style="margin: 8px 0 0 0; padding: 8px; background: #f9fafb; border-radius: 4px; color: #4b5563; font-size: 12px;">${app.notes}</p>` : ''}
    </div>
  `
    )
    .join('');

  return `
    <div style="max-width: 800px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
        <h1 style="margin: 0 0 8px 0; color: #111827; font-size: 24px;">${title}</h1>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Generated on ${date}</p>
        <p style="margin: 8px 0 0 0; color: #4b5563; font-size: 14px;">Total Applications: ${applications.length}</p>
        <div style="margin-top: 12px;">${statusSummary}</div>
      </div>
      ${applicationsHTML}
    </div>
  `;
}

/**
 * Export saved jobs to CSV
 */
export function exportJobsToCSV(jobs: ExportableJob[], filename: string = 'saved-jobs'): void {
  const columns: { key: keyof ExportableJob; label: string }[] = [
    { key: 'title', label: 'Job Title' },
    { key: 'company', label: 'Company' },
    { key: 'location', label: 'Location' },
    { key: 'salary', label: 'Salary' },
    { key: 'url', label: 'Job URL' },
    { key: 'source', label: 'Source' },
    { key: 'tags', label: 'Tags' },
    { key: 'savedAt', label: 'Saved At' },
  ];

  exportToCSV(jobs, filename, columns);
}

/**
 * Export applications to CSV
 */
export function exportApplicationsToCSV(
  applications: ExportableApplication[],
  filename: string = 'job-applications'
): void {
  const columns: { key: keyof ExportableApplication; label: string }[] = [
    { key: 'title', label: 'Job Title' },
    { key: 'company', label: 'Company' },
    { key: 'status', label: 'Status' },
    { key: 'location', label: 'Location' },
    { key: 'salary', label: 'Salary' },
    { key: 'appliedAt', label: 'Applied At' },
    { key: 'nextStep', label: 'Next Step' },
    { key: 'nextStepDate', label: 'Next Step Date' },
    { key: 'notes', label: 'Notes' },
    { key: 'url', label: 'Job URL' },
  ];

  exportToCSV(applications, filename, columns);
}

/**
 * Export saved jobs to PDF
 */
export async function exportJobsToPDF(jobs: ExportableJob[], filename: string = 'saved-jobs'): Promise<void> {
  const html = generateJobsReportHTML(jobs);
  await exportToPDF(html, filename);
}

/**
 * Export applications to PDF
 */
export async function exportApplicationsToPDF(
  applications: ExportableApplication[],
  filename: string = 'job-applications'
): Promise<void> {
  const html = generateApplicationsReportHTML(applications);
  await exportToPDF(html, filename);
}
