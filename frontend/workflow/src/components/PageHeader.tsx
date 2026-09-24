import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';

export interface Crumb {
  label: string;
  to?: string;
  /** For in-page screens (a wizard over a list) where going back is a state change, not a route. */
  onClick?: () => void;
}

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Primary action goes last, so it sits nearest the content it affects. */
  actions?: ReactNode;
  /** Trail back to the parent screen. The current page is the title, not a crumb. */
  breadcrumbs?: Crumb[];
  /** Badges beside the title — status, priority. */
  badges?: ReactNode;
  /** A row of facts under the title, separated by dots. */
  meta?: ReactNode;
}

/** The single page title treatment. Every screen had written its own. */
const PageHeader = ({ title, subtitle, actions, breadcrumbs, badges, meta }: PageHeaderProps) => (
  <header className="mb-6">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav aria-label="Breadcrumb" className="mb-2">
        <ol className="flex flex-wrap items-center gap-1 text-meta text-ink-subtle">
          {breadcrumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
              {crumb.to ? (
                <Link to={crumb.to} className="font-medium hover:text-ink hover:underline underline-offset-2">
                  {crumb.label}
                </Link>
              ) : crumb.onClick ? (
                <button type="button" onClick={crumb.onClick} className="font-medium hover:text-ink hover:underline underline-offset-2 cursor-pointer">
                  {crumb.label}
                </button>
              ) : (
                <span className="font-medium">{crumb.label}</span>
              )}
              <FiChevronRight aria-hidden="true" className="text-ink-subtle/70" />
            </li>
          ))}
        </ol>
      </nav>
    )}
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-heading font-semibold text-ink break-words min-w-0">{title}</h1>
          {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
        {subtitle && <p className="mt-1 text-body text-ink-muted max-w-3xl">{subtitle}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-subtle">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
