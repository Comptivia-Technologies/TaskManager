import { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  /** Rendered in a fixed-width slot so an arriving count never shifts the strip. */
  count?: number;
  /** Decorative icon before the label. */
  icon?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string | null;
  onChange: (id: string) => void;
  /** Names the tab strip for assistive tech. */
  label: string;
}

/**
 * Horizontal tab strip. Scrolls rather than wraps on a narrow screen, and each tab
 * is 44px tall so it clears the minimum touch target.
 */
const Tabs = ({ tabs, activeId, onChange, label }: TabsProps) => (
  <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
    <div role="tablist" aria-label={label} className="flex gap-6 border-b border-line min-w-max">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative inline-flex items-center gap-2 h-11 text-body font-medium -mb-px border-b-2
              whitespace-nowrap cursor-pointer ${
                active ? 'border-primary text-ink' : 'border-transparent text-ink-subtle hover:text-ink hover:border-line-strong'
              }`}
          >
            {tab.icon && <span aria-hidden="true" className={active ? 'text-primary' : ''}>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`min-w-[1.5rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-meta font-semibold tabular ${
                  active ? 'bg-primary text-white' : 'bg-surface-sunken text-ink-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default Tabs;
