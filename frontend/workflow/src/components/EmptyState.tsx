import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  /** Tighter padding for use inside a card section rather than as the page body. */
  compact?: boolean;
}

/**
 * Shown when a list has nothing in it. Says what would appear here and how it gets
 * here, rather than only that the list is empty.
 */
const EmptyState = ({ icon, title, body, action, compact = false }: EmptyStateProps) => (
  <div className={`flex flex-col items-center justify-center text-center px-6 ${compact ? 'py-8' : 'py-14'}`}>
    {icon && (
      <div
        aria-hidden="true"
        className="mb-4 h-12 w-12 rounded-card bg-primary-subtle ring-1 ring-inset ring-primary-border
          text-primary text-[22px] flex items-center justify-center"
      >
        {icon}
      </div>
    )}
    <h2 className="text-title font-semibold text-ink">{title}</h2>
    {body && <p className="mt-1 text-body text-ink-muted max-w-md">{body}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
