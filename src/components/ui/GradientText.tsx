import { ReactNode } from 'react';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  from?: string;
  to?: string;
  animate?: boolean;
}

export function GradientText({
  children,
  className = '',
  from = 'from-blue-500',
  to = 'to-purple-500',
  animate = false,
}: GradientTextProps) {
  return (
    <span
      className={`
        bg-gradient-to-r ${from} ${to}
        bg-clip-text text-transparent
        ${animate ? 'animate-gradient bg-[length:200%_auto]' : ''}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
