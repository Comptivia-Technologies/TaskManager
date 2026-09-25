interface StageProgressProps {
  /** Number of stages in the workflow. */
  total: number;
  /** 1-based position of the stage the enquiry is at. 0 when not yet placed. */
  current: number;
  /** Every stage done — the whole bar reads as finished. */
  done?: boolean;
  /** Sent back: the current segment is marked as rework rather than progress. */
  rework?: boolean;
  /** Current stage name, printed under the bar. */
  stageName?: string;
  compact?: boolean;
}

/**
 * Where an enquiry is in its workflow, at a glance: one segment per stage, filled
 * up to where it is now. Segments are separated by a 2px gap so eleven of them
 * still read as steps rather than a smear. The position is always printed as
 * text beside the bar, so the colour is never the only signal.
 */
const StageProgress = ({ total, current, done = false, rework = false, stageName, compact = false }: StageProgressProps) => {
  if (total <= 0) return <span className="text-ink-subtle">—</span>;
  const position = Math.min(Math.max(current, 0), total);
  const label = done ? 'Complete' : position > 0 ? `${position}/${total}` : `–/${total}`;

  return (
    <div className="min-w-[140px] max-w-[220px]">
      <div className="flex items-center gap-2">
        <div
          className="flex flex-1 gap-[2px]"
          role="img"
          aria-label={done ? `All ${total} stages complete` : `Stage ${position} of ${total}${rework ? ', sent back' : ''}`}
        >
          {Array.from({ length: total }).map((_, i) => {
            const n = i + 1;
            const fill = done || n < position
              ? 'bg-success-strong'
              : n === position
                ? rework ? 'bg-warning-strong' : 'bg-primary'
                : 'bg-line';
            return <span key={n} className={`h-1.5 flex-1 first:rounded-l-full last:rounded-r-full ${fill}`} />;
          })}
        </div>
        <span className={`text-meta font-mono tabular shrink-0 ${done ? 'text-success' : 'text-ink-muted'}`}>{label}</span>
      </div>
      {!compact && stageName && (
        <p className="mt-1 text-meta text-ink-subtle truncate" title={stageName}>
          {stageName}
        </p>
      )}
    </div>
  );
};

export default StageProgress;
