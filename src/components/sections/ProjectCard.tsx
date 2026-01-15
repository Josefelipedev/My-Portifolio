'use client';

import Image from 'next/image';
import Card3D from '../ui/Card3D';
import ScrollReveal from '../ui/ScrollReveal';

interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string;
  repoUrl: string;
  demoUrl: string | null;
  imageUrl: string | null;
  stars: number | null;
  featured: boolean;
  source: string;
  aiSummary: string | null;
}

interface ProjectCardProps {
  project: Project;
  index: number;
}

export default function ProjectCard({ project, index }: ProjectCardProps) {
  return (
    <ScrollReveal delay={index * 100} direction="up">
      <Card3D className="h-full">
        <article className="group relative h-full bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50 hover:border-blue-500/50 transition-all duration-500">
          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500" />

          {/* Featured badge */}
          {project.featured && (
            <div className="absolute top-4 right-4 z-10">
              <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium rounded-full shadow-lg shadow-amber-500/25">
                Featured
              </span>
            </div>
          )}

          {/* Project image or gradient placeholder */}
          <div className="relative h-48 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 flex items-center justify-center overflow-hidden">
            {project.imageUrl ? (
              <Image
                src={project.imageUrl}
                alt={`${project.title} project thumbnail`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="relative">
                <div className="text-8xl font-bold text-blue-500/20 group-hover:scale-110 transition-transform duration-500" aria-hidden="true">
                  {project.title.charAt(0)}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-800/80 to-transparent" />
              </div>
            )}

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-transparent to-transparent" />
          </div>

          {/* Content */}
          <div className="relative p-6">
            {/* Title and stars */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-xl font-semibold text-white group-hover:text-blue-400 transition-colors duration-300">
                {project.title}
              </h3>
              {project.stars !== null && project.stars > 0 && (
                <div className="flex items-center gap-1 text-amber-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-medium">{project.stars}</span>
                </div>
              )}
            </div>

            {/* Description or AI Summary */}
            <p className="text-zinc-400 text-sm mb-4 line-clamp-3 leading-relaxed">
              {project.aiSummary || project.description}
            </p>

            {/* Technologies */}
            <div className="flex flex-wrap gap-2 mb-4">
              {project.technologies.split(',').slice(0, 4).map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 text-xs font-medium bg-slate-700/50 text-zinc-300 rounded-md border border-slate-600/50"
                >
                  {tech.trim()}
                </span>
              ))}
              {project.technologies.split(',').length > 4 && (
                <span className="px-2 py-1 text-xs font-medium bg-slate-700/50 text-zinc-400 rounded-md border border-slate-600/50">
                  +{project.technologies.split(',').length - 4}
                </span>
              )}
            </div>

            {/* Source badge */}
            {project.source === 'github' && (
              <div className="flex items-center gap-1 text-xs text-zinc-500 mb-4">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span>Imported from GitHub</span>
              </div>
            )}

            {/* Links */}
            <div className="flex items-center gap-3">
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View ${project.title} source code on GitHub`}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 text-zinc-300 rounded-xl hover:bg-slate-600/50 transition-all duration-300 text-sm font-medium border border-slate-600/50 hover:border-slate-500/50"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                Code
              </a>
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${project.title} live demo`}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Demo
                </a>
              )}
            </div>
          </div>
        </article>
      </Card3D>
    </ScrollReveal>
  );
}
