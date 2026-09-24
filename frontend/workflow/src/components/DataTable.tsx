import { ReactNode, useMemo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { FiArrowDown, FiArrowUp, FiChevronRight } from 'react-icons/fi';
import { SkeletonRows } from './Skeleton';
import { listItem, MAX_STAGGER_ROWS } from '../utils/motion';

export interface Column<T> {
  key: string;
  header: string;
  /** Cell contents. Return a string for plain text. */
  render: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  /** Numeric and reference columns render in the mono face so they align vertically. */
  mono?: boolean;
  align?: 'left' | 'right';
  /** Hidden below `md`, for columns that are secondary on a narrow screen. */
  hideOnMobile?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Announced to screen readers; also the table's accessible name. */
  caption: string;
  /** Marks a row that needs attention — overdue, sent back — with an edge stripe. */
  rowTone?: (row: T) => 'danger' | 'warning' | undefined;
  /**
   * Below `md` each row renders as this card instead of a squeezed table row.
   * Omit to keep the table and let it scroll sideways.
   */
  mobileCard?: (row: T) => ReactNode;
  /** Sits above the header row: search, filters, counts. */
  toolbar?: ReactNode;
}

const TONE_EDGE = {
  danger: 'shadow-[inset_3px_0_0_0_#C9372C]',
  warning: 'shadow-[inset_3px_0_0_0_#DC6803]',
};

/**
 * The one table in the application. Sticky header, click-to-sort, a skeleton that
 * reserves the real height while loading, and a card layout on a phone.
 *
 * Sorting is client-side and intentional: every list in this app is already fully
 * loaded in the page, so sorting server-side would cost a round-trip for no gain.
 */
function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  onRowClick,
  caption,
  rowTone,
  mobileCard,
  toolbar,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const reduceMotion = useReducedMotion();
  // Rows fade in the first time a queue resolves. Re-sorting an already-visible list
  // must not replay it, or every sort looks like a page load.
  const hasAnimated = useRef(false);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (left === right) return 0;
      return left > right ? factor : -factor;
    });
  }, [rows, sort, columns]);

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, dir: 'asc' }
    );
  };

  const frame = 'bg-surface border border-line rounded-card shadow-azure-sm overflow-hidden';
  const toolbarRow = toolbar ? (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-line bg-surface">{toolbar}</div>
  ) : null;

  if (loading) {
    return (
      <div className={frame}>
        {toolbarRow}
        <p className="sr-only" role="status">Loading {caption}</p>
        <div className="h-10 bg-surface-muted border-b border-line" />
        <SkeletonRows columns={Math.min(columns.length, 5)} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={frame}>
        {toolbarRow}
        {empty}
      </div>
    );
  }

  const activate = (row: T) => onRowClick?.(row);

  return (
    <div className={frame}>
      {toolbarRow}

      {mobileCard && (
        <ul className="md:hidden divide-y divide-line" aria-label={caption}>
          {sorted.map((row) => {
            const tone = rowTone?.(row);
            return (
              <li key={rowKey(row)} className={tone ? TONE_EDGE[tone] : undefined}>
                {onRowClick ? (
                  <button
                    type="button"
                    onClick={() => activate(row)}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-muted cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">{mobileCard(row)}</div>
                    <FiChevronRight aria-hidden="true" className="shrink-0 text-ink-subtle" />
                  </button>
                ) : (
                  <div className="px-4 py-3">{mobileCard(row)}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={`overflow-x-auto scrollbar-thin ${mobileCard ? 'hidden md:block' : ''}`}>
        <table className="min-w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const sortable = Boolean(column.sortValue);
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`eyebrow px-4 h-10 border-b border-line whitespace-nowrap
                      ${column.align === 'right' ? 'text-right' : 'text-left'}
                      ${column.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={`group inline-flex items-center gap-1 uppercase tracking-[0.06em] cursor-pointer
                          hover:text-ink ${active ? 'text-ink' : ''}`}
                      >
                        {column.header}
                        <span aria-hidden="true" className={`text-[12px] ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}>
                          {active && sort!.dir === 'desc' ? <FiArrowDown /> : <FiArrowUp />}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {onRowClick && <th scope="col" aria-hidden="true" className="w-10 border-b border-line" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => {
              const tone = rowTone?.(row);
              return (
                <m.tr
                  key={rowKey(row)}
                  initial={reduceMotion || hasAnimated.current ? false : 'initial'}
                  animate="animate"
                  variants={listItem}
                  transition={{
                    duration: 0.18,
                    delay: index < MAX_STAGGER_ROWS ? index * 0.02 : 0,
                  }}
                  onAnimationComplete={() => {
                    hasAnimated.current = true;
                  }}
                  onClick={onRowClick ? () => activate(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            activate(row);
                          }
                        }
                      : undefined
                  }
                  className={`group border-b border-line last:border-b-0 ${tone ? TONE_EDGE[tone] : ''}
                    ${onRowClick ? 'cursor-pointer hover:bg-surface-muted focus-visible:bg-primary-subtle focus:outline-none' : ''}`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-body text-ink align-middle
                        ${column.align === 'right' ? 'text-right' : 'text-left'}
                        ${column.mono ? 'font-mono text-meta tabular' : ''}
                        ${column.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {onRowClick && (
                    <td className="pr-3 text-right align-middle">
                      <FiChevronRight
                        aria-hidden="true"
                        className="inline text-ink-subtle opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition duration-150"
                      />
                    </td>
                  )}
                </m.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
