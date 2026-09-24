import { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary';

interface BadgeProps {
  tone?: BadgeTone;
  /** Shown before the label. Decorative: the label already carries the meaning. */
  icon?: ReactNode;
  /** A small status dot instead of an icon. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted ring-line-strong',
  primary: 'bg-primary-subtle text-primary ring-primary-border',
  info: 'bg-info-subtle text-info ring-info-border',
  success: 'bg-success-subtle text-success ring-success-border',
  warning: 'bg-warning-subtle text-warning ring-warning-border',
  danger: 'bg-danger-subtle text-danger ring-danger-border',
};

const dots: Record<BadgeTone, string> = {
  neutral: 'bg-ink-subtle',
  primary: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success-strong',
  warning: 'bg-warning-strong',
  danger: 'bg-danger',
};

/**
 * Status pill. Always renders a text label rather than a bare colour dot, because
 * status must not be conveyed by colour alone.
 */
const Badge = ({ tone = 'neutral', icon, dot = false, children, className = '' }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full ring-1 ring-inset
      text-meta font-medium whitespace-nowrap ${tones[tone]} ${className}`}
  >
    {dot && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full shrink-0 ${dots[tone]}`} />}
    {icon && <span aria-hidden="true" className="shrink-0 -ml-0.5">{icon}</span>}
    {children}
  </span>
);

export default Badge;
