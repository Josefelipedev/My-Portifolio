'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Experience } from '@prisma/client';

export default function ExperienceAdmin({ experiences: initialExperiences }: { experiences: Experience[] }) {
  const [experiences] = useState<Experience[]>(initialExperiences);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [challenges, setChallenges] = useState('');
  const [technologies, setTechnologies] = useState('');
  const [expandedExperience, setExpandedExperience] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/experiences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, responsibilities, challenges, technologies }),
    });
    if (res.ok) {
      router.refresh();
      resetForm();
      setIsModalOpen(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setResponsibilities('');
    setChallenges('');
    setTechnologies('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this experience?')) return;
    const res = await fetch(`/api/experiences/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    }
  };

  return (
    <div className="w-full">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Experiences ({experiences.length})
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Experience
        </button>
      </div>

      {/* Compact Experiences List */}
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
        {experiences.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No experiences yet. Add one above!</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {experiences.map((experience) => (
              <div key={experience.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                {/* Main Row */}
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Expand Button */}
                    <button
                      onClick={() => setExpandedExperience(expandedExperience === experience.id ? null : experience.id)}
                      className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 text-zinc-500 transition-transform ${expandedExperience === experience.id ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Title */}
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {experience.title}
                    </span>
                    {experience.company && (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        @ {experience.company}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleDelete(experience.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete experience"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedExperience === experience.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="pt-3 space-y-3 text-sm">
                      <p className="text-zinc-600 dark:text-zinc-400">{experience.description}</p>

                      {experience.responsibilities && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Responsibilities:</p>
                          <p className="text-zinc-600 dark:text-zinc-400">{experience.responsibilities}</p>
                        </div>
                      )}

                      {experience.challenges && (
                        <div>
                          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Challenges:</p>
                          <p className="text-zinc-600 dark:text-zinc-400">{experience.challenges}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {experience.technologies.split(',').map((tech, i) => (
                          <span key={i} className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs rounded">
                            {tech.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsModalOpen(false)}>
          <div
            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add New Experience</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title *</label>
                  <input
                    type="text"
                    placeholder="Job title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Technologies *</label>
                  <input
                    type="text"
                    placeholder="React, Node.js, TypeScript"
                    value={technologies}
                    onChange={(e) => setTechnologies(e.target.value)}
                    className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description *</label>
                <textarea
                  placeholder="Brief description of the role"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm"
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Responsibilities *</label>
                <textarea
                  placeholder="Key responsibilities (comma-separated)"
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm"
                  rows={2}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Challenges *</label>
                <textarea
                  placeholder="Challenges overcome (comma-separated)"
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm"
                  rows={2}
                  required
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Add Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
