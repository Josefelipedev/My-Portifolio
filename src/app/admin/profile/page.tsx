'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

interface SiteConfig {
  id: string;
  name: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  email: string | null;
  location: string | null;
}

interface GitHubData {
  name: string;
  login: string;
  avatar: string;
  bio: string;
  location: string | null;
  email: string | null;
  company: string | null;
  blog: string | null;
  hasReadme: boolean;
}

export default function ProfilePage() {
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [githubData, setGithubData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
    avatarUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    email: '',
    location: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/profile/sync');
      const data = await res.json();

      if (data.siteConfig) {
        setSiteConfig(data.siteConfig);
        setFormData({
          name: data.siteConfig.name || '',
          title: data.siteConfig.title || '',
          bio: data.siteConfig.bio || '',
          avatarUrl: data.siteConfig.avatarUrl || '',
          githubUrl: data.siteConfig.githubUrl || '',
          linkedinUrl: data.siteConfig.linkedinUrl || '',
          twitterUrl: data.siteConfig.twitterUrl || '',
          email: data.siteConfig.email || '',
          location: data.siteConfig.location || '',
        });
      }

      if (data.githubData) {
        setGithubData(data.githubData);
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
      setMessage({ type: 'error', text: 'Failed to load profile data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile/sync', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Profile synced from GitHub successfully!' });
        await fetchData(); // Reload data
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to sync profile' });
      }
    } catch (error) {
      console.error('Sync error:', error);
      setMessage({ type: 'error', text: 'Failed to sync profile from GitHub' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Profile saved successfully!' });
        setSiteConfig(data.data);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save profile' });
      }
    } catch (error) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (loading) {
    return (
      <AdminLayout title="Profile" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Profile" subtitle="Manage your About Me section">
      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GitHub Sync Card */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white dark:text-zinc-900" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">GitHub Sync</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Update from GitHub profile</p>
              </div>
            </div>

            {githubData && (
              <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  {githubData.avatar && (
                    <img
                      src={githubData.avatar}
                      alt={githubData.name}
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{githubData.name}</p>
                    <p className="text-sm text-zinc-500">@{githubData.login}</p>
                  </div>
                </div>
                {githubData.bio && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{githubData.bio}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  {githubData.location && (
                    <span className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded">
                      📍 {githubData.location}
                    </span>
                  )}
                  {githubData.hasReadme && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      README found
                    </span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync from GitHub
                </>
              )}
            </button>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 text-center">
              This will update your profile with data from your GitHub account
            </p>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Edit Profile</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Full Stack Developer"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Avatar URL
                </label>
                <input
                  type="url"
                  name="avatarUrl"
                  value={formData.avatarUrl}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  GitHub URL
                </label>
                <input
                  type="url"
                  name="githubUrl"
                  value={formData.githubUrl}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Twitter URL
                </label>
                <input
                  type="url"
                  name="twitterUrl"
                  value={formData.twitterUrl}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
