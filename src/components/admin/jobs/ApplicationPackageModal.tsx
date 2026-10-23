'use client';

import { useEffect, useState } from 'react';
import resumeData from '@/data/resume.json';
import type { CustomCVContent } from '@/types/jobs';
import { apiFetch } from '@/lib/api-fetch';
import { createCVPdfBlob } from './CVGeneratorButton';
import { useToast } from '@/components/ui/Toast';

interface ReviewIssue {
  severity: 'error' | 'warning' | 'suggestion';
  artifact: string;
  reason: string;
  evidence?: string;
}

interface SentEmail {
  channel: 'email' | 'manual';
  emailed: boolean;
  recipient: string | null;
  subject: string | null;
  body: string | null;
  attachment: { filename: string; sha256: string | null; size: number | null; attached: boolean } | null;
  applicationId: string;
  acknowledgedWarnings: boolean;
  sentAt: string;
}

interface ApplicationPackage {
  id: string;
  version: number;
  status: string;
  reviewStatus: string;
  atsStatus: string;
  recipient: string | null;
  sentAt: string | null;
  applicationId: string | null;
  createdAt: string;
  documents: {
    cv: CustomCVContent;
    coverLetter: string;
    email: { subject: string; body: string } | null;
    review: {
      approved: boolean;
      summary: string;
      issues: ReviewIssue[];
      gaps: string[];
    } | null;
    atsReport: {
      passed: boolean;
      totalPages: number;
      coveragePercent: number;
      checks: Record<string, boolean>;
    } | null;
    sentEmail: SentEmail | null;
  };
}

interface Props {
  job: { id: string; title: string; company: string; contactEmail?: string | null };
  onClose: () => void;
  onSent?: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ApplicationPackageModal({ job, onClose, onSent }: Props) {
  const { showError, showSuccess } = useToast();
  const [packages, setPackages] = useState<ApplicationPackage[]>([]);
  const [selected, setSelected] = useState<ApplicationPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [recipient, setRecipient] = useState(job.contactEmail || '');
  const [deliverByEmail, setDeliverByEmail] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);

  const isSent = selected?.status === 'sent';
  const hasWarnings = !!selected && (selected.reviewStatus !== 'passed' || selected.atsStatus !== 'passed');

  const selectPackage = (value: ApplicationPackage) => {
    setSelected(value);
    setCoverLetter(value.documents.coverLetter || '');
    setEmailSubject(value.documents.email?.subject || '');
    setEmailBody(value.documents.email?.body || '');
    setRecipient(value.recipient || job.contactEmail || '');
    setAcknowledged(false);
  };

  const load = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/api/jobs/saved/${job.id}/application-packages`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load application packages');
      setPackages(data.packages);
      if (data.packages[0]) selectPackage(data.packages[0]);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load application packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // job.id is the modal identity; load only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const prepare = async () => {
    try {
      setPreparing(true);
      const response = await apiFetch(`/api/jobs/saved/${job.id}/application-packages`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to prepare application');
      setPackages((current) => [data.package, ...current]);
      selectPackage(data.package);
      showSuccess(`Application package v${data.package.version} prepared and reviewed`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to prepare application');
    } finally {
      setPreparing(false);
    }
  };

  const saveDocuments = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const response = await apiFetch(`/api/jobs/application-packages/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverLetter, emailSubject, emailBody }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save documents');
      setPackages((current) => current.map((item) => item.id === data.package.id ? data.package : item));
      selectPackage(data.package);
      showSuccess('Application documents saved');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save documents');
    } finally {
      setSaving(false);
    }
  };

  const verifyAndDownload = async () => {
    if (!selected?.documents.cv) return;
    try {
      setVerifying(true);
      const filename = `cv-${job.company}-${job.title}.pdf`.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
      const blob = await createCVPdfBlob(selected.documents.cv, resumeData.personalInfo, job.title, job.company);
      const response = await apiFetch(`/api/jobs/application-packages/${selected.id}/verify-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cvPdfBase64: await blobToBase64(blob), filename }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to verify PDF');
      const updated = { ...selected, atsStatus: data.report.passed ? 'passed' : 'failed', status: data.report.passed && selected.reviewStatus === 'passed' ? 'ready' : selected.status, documents: { ...selected.documents, atsReport: data.report } };
      setSelected(updated);
      setPackages((current) => current.map((item) => item.id === updated.id ? updated : item));
      downloadBlob(blob, filename);
      data.report.passed ? showSuccess('PDF passed ATS checks and was downloaded') : showError('PDF downloaded, but some ATS checks failed');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to verify PDF');
    } finally {
      setVerifying(false);
    }
  };

  // Explicit approval step: sends the archived e-mail with the ATS-verified PDF
  // (or records a portal submission), then freezes this version.
  const sendApplication = async () => {
    if (!selected || selected.status === 'sent') return;
    const unsavedEdits =
      coverLetter !== (selected.documents.coverLetter || '') ||
      emailSubject !== (selected.documents.email?.subject || '') ||
      emailBody !== (selected.documents.email?.body || '');
    if (unsavedEdits) {
      showError('Save your edits first — only the saved version is archived and sent');
      return;
    }
    const confirmation = deliverByEmail
      ? `Send v${selected.version} to ${recipient} with the archived CV attached? This freezes the version.`
      : `Record v${selected.version} as submitted? This freezes the version and marks the job as applied.`;
    if (!window.confirm(confirmation)) return;
    try {
      setSending(true);
      const response = await apiFetch(`/api/jobs/application-packages/${selected.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendEmail: deliverByEmail,
          recipient: deliverByEmail && recipient ? recipient : undefined,
          acknowledgedWarnings: acknowledged || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send application');
      setPackages((current) => current.map((item) => (item.id === data.package.id ? data.package : item)));
      selectPackage(data.package);
      showSuccess(data.emailed ? `Application sent to ${data.package.recipient}` : 'Application recorded as submitted');
      onSent?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to send application');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Application package</h2>
            <p className="text-sm text-zinc-500">{job.title} · {job.company}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={prepare} disabled={preparing} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {preparing ? 'Preparing + reviewing…' : packages.length ? 'Create new version' : 'Prepare application'}
            </button>
            <button onClick={onClose} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600">Close</button>
          </div>
        </div>

        <div className="p-5">
          {loading && <p className="py-12 text-center text-zinc-500">Loading package history…</p>}
          {!loading && !selected && <p className="py-12 text-center text-zinc-500">No package yet. Prepare one to generate, review and verify the application documents.</p>}
          {selected && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                {packages.map((item) => (
                  <button key={item.id} onClick={() => selectPackage(item)} className={`rounded-full px-3 py-1 text-xs font-medium ${item.id === selected.id ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                    v{item.version} · {item.status}
                  </button>
                ))}
                <span className={`rounded-full px-3 py-1 text-xs ${selected.reviewStatus === 'passed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>Review: {selected.reviewStatus}</span>
                <span className={`rounded-full px-3 py-1 text-xs ${selected.atsStatus === 'passed' ? 'bg-green-100 text-green-700' : selected.atsStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>ATS: {selected.atsStatus}</span>
              </div>

              {selected.documents.sentEmail && (
                <section className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950/30">
                  <h3 className="font-semibold text-green-800 dark:text-green-200">
                    {selected.documents.sentEmail.emailed ? 'Sent' : 'Recorded as submitted'} · {new Date(selected.documents.sentEmail.sentAt).toLocaleString()}
                  </h3>
                  <p className="mt-1 text-green-800 dark:text-green-200">
                    {selected.documents.sentEmail.emailed
                      ? `To ${selected.documents.sentEmail.recipient} · subject "${selected.documents.sentEmail.subject}"`
                      : 'Submitted outside e-mail (company portal). No message was delivered from here.'}
                  </p>
                  {selected.documents.sentEmail.attachment?.attached && (
                    <p className="mt-1 font-mono text-xs text-green-700 dark:text-green-300">
                      {selected.documents.sentEmail.attachment.filename} · sha256 {selected.documents.sentEmail.attachment.sha256?.slice(0, 16)}…
                    </p>
                  )}
                  {selected.documents.sentEmail.acknowledgedWarnings && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Sent with unresolved review/ATS warnings, explicitly acknowledged.</p>
                  )}
                  <p className="mt-2 text-xs text-green-700 dark:text-green-300">This version is frozen. Create a new version to change anything.</p>
                </section>
              )}

              {selected.documents.review && (
                <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="font-semibold">Independent review</h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{selected.documents.review.summary}</p>
                  {selected.documents.review.issues.length > 0 && <div className="mt-3 space-y-2">{selected.documents.review.issues.map((issue, index) => (
                    <div key={`${issue.reason}-${index}`} className={`rounded-lg p-3 text-sm ${issue.severity === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200' : issue.severity === 'warning' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200' : 'bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200'}`}>
                      <strong>{issue.artifact} · {issue.severity}</strong>: {issue.reason}
                    </div>
                  ))}</div>}
                </section>
              )}

              <section>
                <label className="mb-2 block font-semibold">Cover letter</label>
                <textarea value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} rows={14} disabled={isSent} className="w-full rounded-xl border border-zinc-300 bg-white p-4 text-sm leading-6 disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800" />
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block font-semibold">Email subject</label>
                  <input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} disabled={isSent} className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800" />
                </div>
                <div className="md:row-span-2">
                  <label className="mb-2 block font-semibold">Application email</label>
                  <textarea value={emailBody} onChange={(event) => setEmailBody(event.target.value)} rows={7} disabled={isSent} className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800" />
                </div>
              </section>

              {selected.documents.atsReport && (
                <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="font-semibold">ATS verification · {selected.documents.atsReport.coveragePercent}% keyword coverage</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {Object.entries(selected.documents.atsReport.checks).map(([name, passed]) => <span key={name} className={`rounded-full px-2 py-1 ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{passed ? '✓' : '✕'} {name}</span>)}
                  </div>
                </section>
              )}

              {!isSent && (
                <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <h3 className="font-semibold">Approve &amp; send</h3>
                  <p className="mt-1 text-sm text-zinc-500">The saved e-mail above is delivered exactly as written, with the ATS-verified CV attached. Sending freezes this version and marks the job as applied.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={deliverByEmail} onChange={() => setDeliverByEmail(true)} /> Send by e-mail
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={!deliverByEmail} onChange={() => setDeliverByEmail(false)} /> I applied on the portal — just record it
                    </label>
                  </div>
                  {deliverByEmail && (
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-medium">Recipient</label>
                      <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="recruiter@company.com" className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 md:max-w-md" />
                      {!selected.documents.atsReport && <p className="mt-2 text-xs text-amber-600">Run “Verify ATS &amp; download CV” first so the archived PDF can be attached.</p>}
                    </div>
                  )}
                  {hasWarnings && (
                    <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" />
                      <span>Review is “{selected.reviewStatus}” and ATS is “{selected.atsStatus}”. I reviewed the documents myself and want to send anyway.</span>
                    </label>
                  )}
                </section>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-700">
                <button onClick={saveDocuments} disabled={saving || isSent} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-600">{saving ? 'Saving…' : 'Save edits'}</button>
                <button onClick={verifyAndDownload} disabled={verifying || !selected.documents.cv} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{verifying ? 'Generating + checking ATS…' : 'Verify ATS & download CV'}</button>
                {!isSent && (
                  <button
                    onClick={sendApplication}
                    disabled={sending || (hasWarnings && !acknowledged) || (deliverByEmail && (!recipient || !selected.documents.atsReport))}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : deliverByEmail ? 'Approve & send application' : 'Approve & record as applied'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
