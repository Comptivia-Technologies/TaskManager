import { ButtonHTMLAttributes, ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { DURATION } from '../utils/motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks further clicks. */
  loading?: boolean;
  /** Decorative — the label carries the meaning, so it is hidden from assistive tech. */
  icon?: ReactNode;
  /** Shown after the label, e.g. a forward chevron on "Next". */
  trailingIcon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white border border-primary shadow-azure-sm hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active',
  secondary:
    'bg-surface text-ink border border-line-strong shadow-azure-sm hover:bg-surface-muted hover:border-[#A9B0C4] active:bg-surface-sunken',
  ghost:
    'bg-transparent text-ink-muted border border-transparent hover:bg-surface-sunken hover:text-ink',
  danger:
    'bg-danger text-white border border-danger shadow-azure-sm hover:bg-danger-strong hover:border-danger-strong',
  success:
    'bg-success text-white border border-success shadow-azure-sm hover:brightness-110',
};

// 40px is the default control height; `sm` is for dense rows and toolbars.
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-meta gap-1.5',
  md: 'h-10 px-4 text-body gap-2',
  lg: 'h-11 px-5 text-body gap-2',
};

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const Button = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  trailingIcon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || loading;

  // A small press is the cheapest way to confirm the click registered, which matters
  // most on the slow actions here — completing a stage waits on an event round-trip.
  const press = reduceMotion || isDisabled ? undefined : { scale: 0.97 };

  return (
    <m.button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      whileTap={press}
      transition={{ duration: DURATION.state }}
      className={`inline-flex items-center justify-center rounded-control font-medium font-sans
        whitespace-nowrap cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...(rest as any)}
    >
      {loading ? <Spinner /> : icon ? <span aria-hidden="true" className="shrink-0 -ml-0.5 text-[1.05em]">{icon}</span> : null}
      {children}
      {trailingIcon && <span aria-hidden="true" className="shrink-0 -mr-0.5">{trailingIcon}</span>}
    </m.button>
  );
};

export default Button;

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control has no other accessible name. */
  label: string;
  icon: ReactNode;
  tone?: 'neutral' | 'danger';
  size?: 'sm' | 'md';
}

/**
 * Square icon-only button for row actions. The label becomes both the accessible
 * name and the hover tooltip, so edit/delete are never a guess.
 */
export const IconButton = ({ label, icon, tone = 'neutral', size = 'md', className = '', type = 'button', ...rest }: IconButtonProps) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={`inline-flex items-center justify-center rounded-control cursor-pointer shrink-0
      text-ink-subtle disabled:opacity-40 disabled:cursor-not-allowed
      ${size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'}
      ${tone === 'danger' ? 'hover:text-danger hover:bg-danger-subtle' : 'hover:text-ink hover:bg-surface-sunken'}
      ${className}`}
    {...rest}
  >
    <span aria-hidden="true" className="text-[16px] leading-none">{icon}</span>
  </button>
);
