import { SectionWrapper } from '../ui/SectionWrapper';
import { GradientText } from '../ui/GradientText';
import { SkillBadge } from '../ui/SkillBadge';
import prisma from '@/lib/prisma';

interface SkillGroup {
  category: string;
  label: string;
  icon: React.ReactNode;
  skills: { name: string; level: number }[];
}

async function getSkills() {
  const skills = await prisma.skill.findMany({
    orderBy: [{ category: 'asc' }, { order: 'asc' }],
  });

  // Group skills by category
  const grouped: Record<string, { name: string; level: number }[]> = {};
  for (const skill of skills) {
    if (!grouped[skill.category]) {
      grouped[skill.category] = [];
    }
    grouped[skill.category].push({ name: skill.name, level: skill.level });
  }

  return grouped;
}

// Default skills if none in database
const defaultSkillGroups: SkillGroup[] = [
  {
    category: 'frontend',
    label: 'Frontend',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    skills: [
      { name: 'React', level: 5 },
      { name: 'Next.js', level: 5 },
      { name: 'TypeScript', level: 4 },
      { name: 'Tailwind CSS', level: 5 },
      { name: 'HTML/CSS', level: 5 },
    ],
  },
  {
    category: 'backend',
    label: 'Backend',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    skills: [
      { name: 'Node.js', level: 4 },
      { name: 'Python', level: 4 },
      { name: 'PostgreSQL', level: 4 },
      { name: 'Prisma', level: 4 },
      { name: 'REST APIs', level: 5 },
    ],
  },
  {
    category: 'tools',
    label: 'Tools & DevOps',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    skills: [
      { name: 'Git', level: 5 },
      { name: 'Docker', level: 3 },
      { name: 'Linux', level: 4 },
      { name: 'CI/CD', level: 3 },
      { name: 'AWS', level: 3 },
    ],
  },
];

export async function SkillsSection() {
  const dbSkills = await getSkills();

  // Use database skills if available, otherwise use defaults
  const hasDbSkills = Object.keys(dbSkills).length > 0;

  const skillGroups = hasDbSkills
    ? defaultSkillGroups.map((group) => ({
        ...group,
        skills: dbSkills[group.category] || group.skills,
      }))
    : defaultSkillGroups;

  return (
    <SectionWrapper id="skills" className="bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          My <GradientText>Skills</GradientText>
        </h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Technologies and tools I use to bring ideas to life
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {skillGroups.map((group, groupIndex) => (
          <div
            key={group.category}
            className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow duration-300 animate-fade-in-up"
            style={{ animationDelay: `${groupIndex * 100}ms` }}
          >
            {/* Category header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-red-500/10 to-purple-500/10 rounded-lg text-red-500">
                {group.icon}
              </div>
              <h3 className="text-xl font-semibold">{group.label}</h3>
            </div>

            {/* Skills list */}
            <div className="space-y-4">
              {group.skills.map((skill) => (
                <div key={skill.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {skill.name}
                    </span>
                    <SkillBadge name={`${skill.level}/5`} variant="gradient" size="sm" />
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${(skill.level / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
