'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Experience } from '@prisma/client';

export default function ExperienceAdmin({ experiences: initialExperiences }: { experiences: Experience[] }) {
  const [experiences, setExperiences] = useState<Experience[]>(initialExperiences);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [challenges, setChallenges] = useState('');
  const [technologies, setTechnologies] = useState('');
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
      setTitle('');
      setDescription('');
      setResponsibilities('');
      setChallenges('');
      setTechnologies('');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/experiences/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    }
  };

  return (
    <div className="w-full max-w-4xl mt-16">
      <h2 className="text-2xl font-bold mb-4">Manage Experience</h2>
      <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="p-2 border rounded"
            required
          />
          <input
            type="text"
            placeholder="Technologies (comma-separated)"
            value={technologies}
            onChange={(e) => setTechnologies(e.target.value)}
            className="p-2 border rounded"
            required
          />
        </div>
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 mt-4 border rounded"
          required
        />
        <textarea
          placeholder="Responsibilities (comma-separated)"
          value={responsibilities}
          onChange={(e) => setResponsibilities(e.target.value)}
          className="w-full p-2 mt-4 border rounded"
          required
        />
        <textarea
          placeholder="Challenges (comma-separated)"
          value={challenges}
          onChange={(e) => setChallenges(e.target.value)}
          className="w-full p-2 mt-4 border rounded"
          required
        />
        <button type="submit" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Add Experience
        </button>
      </form>

      <div className="space-y-4">
        {experiences.map((experience) => (
          <div key={experience.id} className="p-4 border rounded-lg flex justify-between items-center">
            <div>
              <h3 className="font-bold">{experience.title}</h3>
            </div>
            <div className="space-x-2">
              <button className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">Edit</button>
              <button onClick={() => handleDelete(experience.id)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
