interface AvatarProps {
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Dark surfaces (the navigation shell) need a lighter tile. */
  onDark?: boolean;
  className?: string;
}

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-meta',
  lg: 'h-14 w-14 text-title',
};

export const initialsOf = (name?: string) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? '';
  return `${first}${last}`.toUpperCase();
};

/**
 * Initials for a person. Decorative: the name is always printed beside it, so the
 * tile is hidden from assistive tech rather than announced twice.
 */
const Avatar = ({ name, size = 'sm', onDark = false, className = '' }: AvatarProps) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none tracking-wide
      ${onDark ? 'bg-white/10 text-white ring-1 ring-inset ring-white/15' : 'bg-primary-subtle text-primary ring-1 ring-inset ring-primary-border'}
      ${SIZES[size]} ${className}`}
  >
    {initialsOf(name)}
  </span>
);

export default Avatar;
