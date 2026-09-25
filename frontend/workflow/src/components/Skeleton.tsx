interface SkeletonRowsProps {
  rows?: number;
  columns?: number;
}

/**
 * Placeholder rows at the real row height, so the table does not jump when data
 * arrives. Hidden from assistive tech — the live region on the table reports state.
 */
export const SkeletonRows = ({ rows = 5, columns = 4 }: SkeletonRowsProps) => (
  <div aria-hidden="true">
    {Array.from({ length: rows }).map((_, row) => (
      <div key={row} className="flex items-center gap-6 px-4 h-[52px] border-b border-line last:border-b-0">
        {Array.from({ length: columns }).map((_, col) => (
          <div
            key={col}
            className="skeleton h-3"
            style={{ width: col === 0 ? '26%' : `${Math.max(10, 20 - col * 3)}%`, opacity: 1 - row * 0.12 }}
          />
        ))}
      </div>
    ))}
  </div>
);

/** A block placeholder for cards and panels. */
export const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <div aria-hidden="true" className={`skeleton ${className}`} />
);

export default SkeletonRows;
