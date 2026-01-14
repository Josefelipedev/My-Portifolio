'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'pt' | 'en';

interface Translations {
  // Navigation
  nav: {
    home: string;
    about: string;
    github: string;
    skills: string;
    projects: string;
    experience: string;
    contact: string;
  };
  // Hero Section
  hero: {
    greeting: string;
    name: string;
    role: string;
    description: string;
    cta: string;
    downloadCV: string;
  };
  // About Section
  about: {
    title: string;
    subtitle: string;
    passion: string;
    yearsExp: string;
    projectsDone: string;
    techLover: string;
  };
  // GitHub Section
  github: {
    title: string;
    subtitle: string;
    repos: string;
    stars: string;
    forks: string;
    commits: string;
    pullRequests: string;
    issues: string;
    topLanguages: string;
    contributions: string;
    detectedSkills: string;
    viewProfile: string;
    less: string;
    more: string;
  };
  // Skills Section
  skills: {
    title: string;
    subtitle: string;
  };
  // Projects Section
  projects: {
    title: string;
    subtitle: string;
    viewProject: string;
    viewCode: string;
    noProjects: string;
  };
  // Experience Section
  experience: {
    title: string;
    subtitle: string;
    present: string;
    noExperience: string;
  };
  // Contact Section
  contact: {
    title: string;
    subtitle: string;
    name: string;
    email: string;
    message: string;
    send: string;
    sending: string;
    success: string;
    error: string;
  };
  // Footer
  footer: {
    builtWith: string;
    rights: string;
  };
}

const translations: Record<Language, Translations> = {
  pt: {
    nav: {
      home: 'Início',
      about: 'Sobre',
      github: 'GitHub',
      skills: 'Skills',
      projects: 'Projetos',
      experience: 'Experiência',
      contact: 'Contato',
    },
    hero: {
      greeting: 'Olá, eu sou',
      name: 'Jose Felipe Almeida da Silva',
      role: 'Desenvolvedor Full Stack',
      description: 'Apenas um cara apaixonado por tecnologia que está correndo atrás dos seus sonhos e querendo vencer',
      cta: 'Entre em contato',
      downloadCV: 'Download CV',
    },
    about: {
      title: 'Sobre Mim',
      subtitle: 'Conheça um pouco mais sobre minha jornada',
      passion: 'Paixão por código',
      yearsExp: 'Anos de experiência',
      projectsDone: 'Projetos realizados',
      techLover: 'Amante de tecnologia',
    },
    github: {
      title: 'GitHub Stats',
      subtitle: 'Minhas contribuições e atividade no GitHub',
      repos: 'Repositórios',
      stars: 'Stars',
      forks: 'Forks',
      commits: 'Commits',
      pullRequests: 'Pull Requests',
      issues: 'Issues',
      topLanguages: 'Linguagens Mais Usadas',
      contributions: 'Contribuições',
      detectedSkills: 'Skills Detectadas',
      viewProfile: 'Ver perfil completo no GitHub',
      less: 'Menos',
      more: 'Mais',
    },
    skills: {
      title: 'Minhas Skills',
      subtitle: 'Tecnologias e ferramentas que domino',
    },
    projects: {
      title: 'Projetos',
      subtitle: 'Alguns dos meus trabalhos recentes',
      viewProject: 'Ver Projeto',
      viewCode: 'Ver Código',
      noProjects: 'Nenhum projeto cadastrado ainda.',
    },
    experience: {
      title: 'Experiência',
      subtitle: 'Minha trajetória profissional',
      present: 'Presente',
      noExperience: 'Nenhuma experiência cadastrada ainda.',
    },
    contact: {
      title: 'Contato',
      subtitle: 'Vamos conversar? Entre em contato comigo',
      name: 'Nome',
      email: 'Email',
      message: 'Mensagem',
      send: 'Enviar Mensagem',
      sending: 'Enviando...',
      success: 'Mensagem enviada com sucesso!',
      error: 'Erro ao enviar mensagem. Tente novamente.',
    },
    footer: {
      builtWith: 'Feito com Next.js, Tailwind CSS e Claude AI',
      rights: 'Todos os direitos reservados.',
    },
  },
  en: {
    nav: {
      home: 'Home',
      about: 'About',
      github: 'GitHub',
      skills: 'Skills',
      projects: 'Projects',
      experience: 'Experience',
      contact: 'Contact',
    },
    hero: {
      greeting: "Hi, I'm",
      name: 'Jose Felipe Almeida da Silva',
      role: 'Full Stack Developer',
      description: "Just a guy passionate about technology who is chasing his dreams and wanting to succeed",
      cta: 'Get in touch',
      downloadCV: 'Download CV',
    },
    about: {
      title: 'About Me',
      subtitle: 'Learn a little more about my journey',
      passion: 'Passion for code',
      yearsExp: 'Years of experience',
      projectsDone: 'Projects done',
      techLover: 'Tech lover',
    },
    github: {
      title: 'GitHub Stats',
      subtitle: 'My contributions and activity on GitHub',
      repos: 'Repositories',
      stars: 'Stars',
      forks: 'Forks',
      commits: 'Commits',
      pullRequests: 'Pull Requests',
      issues: 'Issues',
      topLanguages: 'Most Used Languages',
      contributions: 'Contributions',
      detectedSkills: 'Detected Skills',
      viewProfile: 'View full profile on GitHub',
      less: 'Less',
      more: 'More',
    },
    skills: {
      title: 'My Skills',
      subtitle: 'Technologies and tools I master',
    },
    projects: {
      title: 'Projects',
      subtitle: 'Some of my recent work',
      viewProject: 'View Project',
      viewCode: 'View Code',
      noProjects: 'No projects registered yet.',
    },
    experience: {
      title: 'Experience',
      subtitle: 'My professional journey',
      present: 'Present',
      noExperience: 'No experience registered yet.',
    },
    contact: {
      title: 'Contact',
      subtitle: "Let's talk? Get in touch with me",
      name: 'Name',
      email: 'Email',
      message: 'Message',
      send: 'Send Message',
      sending: 'Sending...',
      success: 'Message sent successfully!',
      error: 'Error sending message. Please try again.',
    },
    footer: {
      builtWith: 'Built with Next.js, Tailwind CSS, and Claude AI',
      rights: 'All rights reserved.',
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('pt');

  useEffect(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('portfolio-language') as Language;
    if (saved && (saved === 'pt' || saved === 'en')) {
      setLanguage(saved);
    } else {
      // Detect browser language
      const browserLang = navigator.language.slice(0, 2);
      setLanguage(browserLang === 'pt' ? 'pt' : 'en');
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('portfolio-language', lang);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export { translations };
