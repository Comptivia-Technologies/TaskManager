import { ReactNode } from 'react';

interface SectionProps {
  title?: ReactNode;
  /** One line under the title saying what the section is for. */
  description?: ReactNode;
  /** Right-aligned in the header: a count, a link, a small action. */
  actions?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  /** Remove body padding for edge-to-edge lists and tables. */
  flush?: boolean;
  className?: string;
  id?: string;
}

/**
 * A titled card. Most detail screens are a stack of these, so the header rhythm —
 * title, description, a quiet action on the right — is set once here.
 */
const Section = ({ title, description, actions, icon, children, flush = false, className = '', id }: SectionProps) => (
  <section id={id} className={`card ${className}`} aria-labelledby={id && title ? `${id}-title` : undefined}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line-subtle">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon && <span aria-hidden="true" className="mt-0.5 text-ink-subtle text-[16px]">{icon}</span>}
          <div className="min-w-0">
            {title && (
              <h2 id={id ? `${id}-title` : undefined} className="text-title font-semibold text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-meta text-ink-subtle">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
    )}
    <div className={flush ? '' : 'px-5 py-4'}>{children}</div>
  </section>
);

export default Section;
