'use client';

import { useState, useEffect } from 'react';

const navItems = [
  { label: 'Home', href: '#hero' },
  { label: 'About', href: '#about' },
  { label: 'GitHub', href: '#github' },
  { label: 'Skills', href: '#skills' },
  { label: 'Projects', href: '#projects' },
  { label: 'Experience', href: '#experience' },
  { label: 'Contact', href: '#contact' },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Find active section
      const sections = navItems.map((item) => item.href.slice(1));
      for (const section of sections.reverse()) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    const element = document.getElementById(href.slice(1));
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        transition-all duration-500
        ${isScrolled
          ? 'top-4'
          : 'top-6'
        }
      `}
    >
      {/* Desktop Navigation - Floating pill */}
      <div
        className={`
          hidden md:flex items-center gap-1 px-2 py-2 rounded-2xl
          transition-all duration-500
          ${isScrolled
            ? 'bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/20'
            : 'bg-slate-800/50 backdrop-blur-md border border-slate-700/30'
          }
        `}
      >
        {/* Logo */}
        <button
          onClick={() => scrollToSection('#hero')}
          className="px-4 py-2 text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent hover:from-blue-300 hover:to-purple-300 transition-all"
        >
          JF
        </button>

        <div className="w-px h-6 bg-slate-700/50 mx-1" />

        {/* Nav Items */}
        {navItems.map((item) => (
          <button
            key={item.href}
            onClick={() => scrollToSection(item.href)}
            className={`
              relative px-4 py-2 rounded-xl text-sm font-medium
              transition-all duration-300
              ${activeSection === item.href.slice(1)
                ? 'text-white'
                : 'text-zinc-400 hover:text-white'
              }
            `}
          >
            {activeSection === item.href.slice(1) && (
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30" />
            )}
            <span className="relative">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`
            p-3 rounded-2xl transition-all duration-300
            ${isScrolled || isMobileMenuOpen
              ? 'bg-slate-900/90 backdrop-blur-xl border border-slate-700/50'
              : 'bg-slate-800/50 backdrop-blur-md border border-slate-700/30'
            }
          `}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-full mt-2 right-0 w-48 py-2 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollToSection(item.href)}
                className={`
                  w-full px-4 py-3 text-left text-sm font-medium
                  transition-all duration-200
                  ${activeSection === item.href.slice(1)
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-zinc-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
