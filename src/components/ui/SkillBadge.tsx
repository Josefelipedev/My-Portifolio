interface SkillBadgeProps {
  name: string;
  level?: number;
  variant?: 'default' | 'outline' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

const variantClasses = {
  default: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  outline: 'border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300',
  gradient: 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
};

export function SkillBadge({
  name,
  level,
  variant = 'default',
  size = 'md',
}: SkillBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        transition-all duration-200
        hover:scale-105 hover:shadow-md
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
    >
      {name}
      {level !== undefined && (
        <span className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i <= level ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            />
          ))}
        </span>
      )}
    </span>
  );
}
