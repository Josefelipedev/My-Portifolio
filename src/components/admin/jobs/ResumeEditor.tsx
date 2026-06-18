'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api-fetch';

interface Skill {
  name: string;
  level: number;
  category: string;
}

interface Experience {
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string | null;
  responsibilities: string[];
}

interface Certification {
  name: string;
  issuer: string;
  date: string;
  description: string;
}

interface Language {
  language: string;
  level: string;
  notes: string;
}

interface ResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    address: string;
    linkedin: string;
    github: string;
  };
  professionalSummary: { pt: string; en: string };
  skills: Skill[];
  experience: Experience[];
  certifications: Certification[];
  languages: Language[];
}

const EMPTY_RESUME: ResumeData = {
  personalInfo: { name: '', email: '', phone: '', address: '', linkedin: '', github: '' },
  professionalSummary: { pt: '', en: '' },
  skills: [],
  experience: [],
  certifications: [],
  languages: [],
};

const SKILL_CATEGORIES = ['backend', 'frontend', 'mobile', 'devops', 'database', 'other'];

export default function ResumeEditor() {
  const { showToast } = useToast();
  const [resume, setResume] = useState<ResumeData>(EMPTY_RESUME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'personal' | 'skills' | 'experience' | 'certifications' | 'languages' | 'raw'>('skills');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch('/api/jobs/resume')
      .then(r => r.json())
      .then(d => { if (d.resume) setResume(d.resume); })
      .catch(() => showToast('Failed to load resume', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  async function save(data: ResumeData = resume) {
    setSaving(true);
    try {
      const res = await apiFetch('/api/jobs/resume', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast('Resume saved!', 'success');
    } catch {
      showToast('Failed to save resume', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as ResumeData;
        setResume(parsed);
        showToast('JSON loaded — click Save to persist', 'success');
      } catch {
        showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }

  // ── Skills ──────────────────────────────────────────────────────────────────

  function addSkill() {
    setResume(r => ({ ...r, skills: [...r.skills, { name: '', level: 3, category: 'backend' }] }));
  }

  function updateSkill(i: number, field: keyof Skill, value: string | number) {
    setResume(r => {
      const skills = [...r.skills];
      skills[i] = { ...skills[i], [field]: value };
      return { ...r, skills };
    });
  }

  function removeSkill(i: number) {
    setResume(r => ({ ...r, skills: r.skills.filter((_, idx) => idx !== i) }));
  }

  // ── Experience ───────────────────────────────────────────────────────────────

  function addExperience() {
    setResume(r => ({
      ...r,
      experience: [...r.experience, {
        title: '', company: '', location: '', startDate: '', endDate: null, responsibilities: [''],
      }],
    }));
  }

  function updateExperience(i: number, field: keyof Experience, value: string | string[] | null) {
    setResume(r => {
      const experience = [...r.experience];
      experience[i] = { ...experience[i], [field]: value };
      return { ...r, experience };
    });
  }

  function removeExperience(i: number) {
    setResume(r => ({ ...r, experience: r.experience.filter((_, idx) => idx !== i) }));
  }

  function updateResponsibility(expIdx: number, respIdx: number, value: string) {
    setResume(r => {
      const experience = [...r.experience];
      const responsibilities = [...experience[expIdx].responsibilities];
      responsibilities[respIdx] = value;
      experience[expIdx] = { ...experience[expIdx], responsibilities };
      return { ...r, experience };
    });
  }

  // ── Certifications ───────────────────────────────────────────────────────────

  function addCert() {
    setResume(r => ({
      ...r,
      certifications: [...r.certifications, { name: '', issuer: '', date: '', description: '' }],
    }));
  }

  function updateCert(i: number, field: keyof Certification, value: string) {
    setResume(r => {
      const certifications = [...r.certifications];
      certifications[i] = { ...certifications[i], [field]: value };
      return { ...r, certifications };
    });
  }

  function removeCert(i: number) {
    setResume(r => ({ ...r, certifications: r.certifications.filter((_, idx) => idx !== i) }));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sections = [
    { id: 'skills' as const, label: '⚡ Skills', count: resume.skills.length },
    { id: 'experience' as const, label: '💼 Experience', count: resume.experience.length },
    { id: 'certifications' as const, label: '🏆 Certifications', count: resume.certifications.length },
    { id: 'personal' as const, label: '👤 Personal Info' },
    { id: 'languages' as const, label: '🌐 Languages', count: resume.languages.length },
    { id: 'raw' as const, label: '{ } Raw JSON' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Resume for Job Search</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Used by Smart Search to find and score matching jobs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            📂 Upload JSON
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => save()}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 dark:border-zinc-700 pb-3">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeSection === s.id
                ? 'bg-red-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
            }`}
          >
            {s.label}
            {'count' in s && s.count !== undefined && (
              <span className="ml-1.5 opacity-70">({s.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Skills Section ───────────────────────────────────────────────────── */}
      {activeSection === 'skills' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {resume.skills.map((skill, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg border border-zinc-200 dark:border-zinc-600">
                <input
                  value={skill.name}
                  onChange={e => updateSkill(i, 'name', e.target.value)}
                  placeholder="Skill name (e.g. React.js)"
                  className="flex-1 min-w-0 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded"
                />
                <select
                  value={skill.category}
                  onChange={e => updateSkill(i, 'category', e.target.value)}
                  className="px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded"
                >
                  {SKILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-400 w-4 text-center">{skill.level}</span>
                  <input
                    type="range" min={1} max={5} value={skill.level}
                    onChange={e => updateSkill(i, 'level', Number(e.target.value))}
                    className="w-20 accent-red-500"
                    title={`Level: ${skill.level}/5`}
                  />
                </div>
                {/* Level stars */}
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-xs ${s <= skill.level ? 'text-yellow-400' : 'text-zinc-300 dark:text-zinc-600'}`}>★</span>
                  ))}
                </div>
                <button onClick={() => removeSkill(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
          <button
            onClick={addSkill}
            className="w-full py-2 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-500 hover:border-red-400 hover:text-red-500 transition-colors"
          >
            + Add Skill
          </button>
        </div>
      )}

      {/* ── Experience Section ───────────────────────────────────────────────── */}
      {activeSection === 'experience' && (
        <div className="space-y-4">
          {resume.experience.map((exp, i) => (
            <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg border border-zinc-200 dark:border-zinc-600 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-zinc-700 dark:text-zinc-200">Position {i + 1}</h4>
                <button onClick={() => removeExperience(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input value={exp.title} onChange={e => updateExperience(i, 'title', e.target.value)}
                  placeholder="Job title (e.g. Senior Developer)"
                  className="px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                <input value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)}
                  placeholder="Company"
                  className="px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                <input value={exp.location} onChange={e => updateExperience(i, 'location', e.target.value)}
                  placeholder="Location"
                  className="px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                <div className="flex gap-2">
                  <input value={exp.startDate} onChange={e => updateExperience(i, 'startDate', e.target.value)}
                    placeholder="Start (YYYY-MM)"
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                  <input value={exp.endDate ?? ''} onChange={e => updateExperience(i, 'endDate', e.target.value || null)}
                    placeholder="End (or blank)"
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Responsibilities</p>
                {exp.responsibilities.map((r, ri) => (
                  <div key={ri} className="flex gap-2">
                    <input value={r} onChange={e => updateResponsibility(i, ri, e.target.value)}
                      placeholder="Describe a key responsibility…"
                      className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                    <button
                      onClick={() => updateExperience(i, 'responsibilities', exp.responsibilities.filter((_, idx) => idx !== ri))}
                      className="text-zinc-400 hover:text-red-500 text-lg leading-none"
                    >×</button>
                  </div>
                ))}
                <button
                  onClick={() => updateExperience(i, 'responsibilities', [...exp.responsibilities, ''])}
                  className="text-xs text-zinc-400 hover:text-red-500 py-1"
                >+ Add responsibility</button>
              </div>
            </div>
          ))}
          <button
            onClick={addExperience}
            className="w-full py-2 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-500 hover:border-red-400 hover:text-red-500 transition-colors"
          >
            + Add Experience
          </button>
        </div>
      )}

      {/* ── Certifications Section ───────────────────────────────────────────── */}
      {activeSection === 'certifications' && (
        <div className="space-y-3">
          {resume.certifications.map((cert, i) => (
            <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg border border-zinc-200 dark:border-zinc-600 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-zinc-700 dark:text-zinc-200">Certification {i + 1}</h4>
                <button onClick={() => removeCert(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input value={cert.name} onChange={e => updateCert(i, 'name', e.target.value)}
                  placeholder="Certification name"
                  className="px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                <input value={cert.issuer} onChange={e => updateCert(i, 'issuer', e.target.value)}
                  placeholder="Issuer (e.g. AWS)"
                  className="px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                <input value={cert.date} onChange={e => updateCert(i, 'date', e.target.value)}
                  placeholder="Date (YYYY-MM)"
                  className="px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
                <input value={cert.description} onChange={e => updateCert(i, 'description', e.target.value)}
                  placeholder="Brief description"
                  className="px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg" />
              </div>
            </div>
          ))}
          <button
            onClick={addCert}
            className="w-full py-2 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-500 hover:border-red-400 hover:text-red-500 transition-colors"
          >
            + Add Certification
          </button>
        </div>
      )}

      {/* ── Personal Info ────────────────────────────────────────────────────── */}
      {activeSection === 'personal' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(Object.keys(resume.personalInfo) as (keyof typeof resume.personalInfo)[]).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 capitalize">{field}</label>
                <input
                  value={resume.personalInfo[field]}
                  onChange={e => setResume(r => ({ ...r, personalInfo: { ...r.personalInfo, [field]: e.target.value } }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Summary (PT)</label>
              <textarea
                value={resume.professionalSummary?.pt || ''}
                onChange={e => setResume(r => ({ ...r, professionalSummary: { ...r.professionalSummary, pt: e.target.value } }))}
                rows={4}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Summary (EN)</label>
              <textarea
                value={resume.professionalSummary?.en || ''}
                onChange={e => setResume(r => ({ ...r, professionalSummary: { ...r.professionalSummary, en: e.target.value } }))}
                rows={4}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded-lg resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Languages ────────────────────────────────────────────────────────── */}
      {activeSection === 'languages' && (
        <div className="space-y-3">
          {resume.languages.map((lang, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg border border-zinc-200 dark:border-zinc-600">
              <input value={lang.language}
                onChange={e => setResume(r => { const l = [...r.languages]; l[i] = { ...l[i], language: e.target.value }; return { ...r, languages: l }; })}
                placeholder="Language" className="flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded" />
              <input value={lang.level}
                onChange={e => setResume(r => { const l = [...r.languages]; l[i] = { ...l[i], level: e.target.value }; return { ...r, languages: l }; })}
                placeholder="Level (Native / B2 / …)" className="flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded" />
              <input value={lang.notes}
                onChange={e => setResume(r => { const l = [...r.languages]; l[i] = { ...l[i], notes: e.target.value }; return { ...r, languages: l }; })}
                placeholder="Notes" className="flex-1 px-2 py-1 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 rounded" />
              <button onClick={() => setResume(r => ({ ...r, languages: r.languages.filter((_, idx) => idx !== i) }))}
                className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
          ))}
          <button
            onClick={() => setResume(r => ({ ...r, languages: [...r.languages, { language: '', level: '', notes: '' }] }))}
            className="w-full py-2 text-sm border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-500 hover:border-red-400 hover:text-red-500 transition-colors"
          >
            + Add Language
          </button>
        </div>
      )}

      {/* ── Raw JSON ─────────────────────────────────────────────────────────── */}
      {activeSection === 'raw' && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Edit the raw JSON directly. Changes are merged on Save.
          </p>
          <textarea
            value={JSON.stringify(resume, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value) as ResumeData;
                setResume(parsed);
              } catch {
                // ignore parse errors while typing
              }
            }}
            rows={28}
            className="w-full px-3 py-2 text-xs font-mono bg-zinc-900 text-green-400 border border-zinc-600 rounded-lg resize-none"
            spellCheck={false}
          />
        </div>
      )}

      {/* Floating save hint */}
      <p className="text-xs text-zinc-400 text-center pt-2">
        Changes are local until you click <strong>Save</strong>. The Smart Search will use the saved resume.
      </p>
    </div>
  );
}
