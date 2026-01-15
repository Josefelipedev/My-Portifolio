import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ParticlesBackground from '@/components/ui/ParticlesBackground';
import CustomCursor from '@/components/ui/CustomCursor';
import GridBackground from '@/components/ui/GridBackground';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: {
    default: 'Jose Felipe | Full Stack Developer',
    template: '%s | Jose Felipe',
  },
  description:
    'Portfolio de Jose Felipe Almeida da Silva - Desenvolvedor Full Stack apaixonado por tecnologia. Built with Next.js, featuring GitHub integration and AI-powered project summaries.',
  keywords: [
    'Jose Felipe',
    'portfolio',
    'developer',
    'full stack',
    'react',
    'nextjs',
    'typescript',
    'web development',
    'software engineer',
  ],
  authors: [{ name: 'Jose Felipe Almeida da Silva' }],
  creator: 'Jose Felipe Almeida da Silva',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Jose Felipe | Full Stack Developer',
    description:
      'Portfolio de Jose Felipe Almeida da Silva - Desenvolvedor Full Stack apaixonado por tecnologia.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Jose Felipe Portfolio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jose Felipe | Full Stack Developer',
    description:
      'Portfolio de Jose Felipe Almeida da Silva - Desenvolvedor Full Stack apaixonado por tecnologia.',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth dark" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-slate-900 text-white`}>
        <Providers>
          {/* Background Effects */}
          <GridBackground />
          <ParticlesBackground />

          {/* Custom Cursor */}
          <CustomCursor />

          {/* Main Content */}
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
