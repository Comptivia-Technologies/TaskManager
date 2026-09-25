import { useState } from 'react';
import { FiAlertTriangle, FiArrowRight, FiCheck, FiCircle, FiCornerUpLeft, FiUserPlus } from 'react-icons/fi';
import { TaskStageHistory } from '../../types';
import { formatDateToIST, timeAgo } from '../../utils/dateUtils';

interface ActivityTimelineProps {
  history: TaskStageHistory[];
  /** How many events show before "Show all". */
  initialCount?: number;
}

const KIND = {
  Completed: { icon: FiCheck, tile: 'bg-success-subtle text-success ring-success-border' },
  Assigned: { icon: FiUserPlus, tile: 'bg-primary-subtle text-primary ring-primary-border' },
  Returned: { icon: FiCornerUpLeft, tile: 'bg-warning-subtle text-warning ring-warning-border' },
  Escalated: { icon: FiAlertTriangle, tile: 'bg-danger-subtle text-danger ring-danger-border' },
} as const;

const describe = (entry: TaskStageHistory) => {
  switch (entry.action) {
    case 'Completed':
      return { who: entry.memberName, what: `completed ${entry.fromStageName || entry.stageName}` };
    case 'Assigned':
      return { who: entry.memberName, what: `was assigned ${entry.toStageName || entry.stageName}` };
    case 'Returned':
      return { who: entry.memberName, what: `sent it back to ${entry.toStageName || 'an earlier stage'}` };
    case 'Escalated':
      return { who: entry.memberName, what: `escalated ${entry.stageName}` };
    default:
      return { who: entry.memberName, what: `${entry.action.toLowerCase()} · ${entry.stageName}` };
  }
};

/**
 * What happened to this enquiry, newest first. Each event is one sentence — who
 * did what — with the hand-off beneath it and any reason given quoted, because
 * "why was this sent back" is the question people open the feed to answer.
 */
const ActivityTimeline = ({ history, initialCount = 8 }: ActivityTimelineProps) => {
  const [expanded, setExpanded] = useState(false);
  const ordered = [...history].sort((a, b) => b.sequence - a.sequence);
  const visible = expanded ? ordered : ordered.slice(0, initialCount);

  if (ordered.length === 0) {
    return <p className="text-body text-ink-subtle">No activity yet.</p>;
  }

  return (
    <div>
      <ol className="relative">
        {visible.map((entry, index) => {
          const kind = KIND[entry.action as keyof typeof KIND];
          const Icon = kind?.icon ?? FiCircle;
          const { who, what } = describe(entry);
          const isLast = index === visible.length - 1;
          const moved = entry.action === 'Completed' && entry.toStageName;
          return (
            <li key={entry.historyId} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-0 w-px bg-line" />}
              <span
                aria-hidden="true"
                className={`relative z-[1] mt-0.5 h-7 w-7 shrink-0 rounded-full ring-1 ring-inset flex items-center justify-center text-[13px] ${
                  kind?.tile ?? 'bg-surface-sunken text-ink-subtle ring-line'
                }`}
              >
                <Icon />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-body text-ink leading-5">
                  <span className="font-semibold">{who}</span> <span className="text-ink-muted">{what}</span>
                </p>
                {moved && (
                  <p className="mt-0.5 text-meta text-ink-subtle inline-flex items-center gap-1">
                    <FiArrowRight aria-hidden="true" /> moved to {entry.toStageName}
                  </p>
                )}
                {entry.reason && (
                  <blockquote className="mt-1.5 text-meta text-ink-muted bg-warning-subtle/60 border-l-2 border-warning-strong rounded-r px-2.5 py-1.5">
                    {entry.reason}
                  </blockquote>
                )}
                <time
                  dateTime={entry.occurredAt}
                  title={formatDateToIST(entry.occurredAt)}
                  className="mt-0.5 block text-[11px] text-ink-subtle"
                >
                  {timeAgo(entry.occurredAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      {ordered.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-meta font-medium text-primary hover:text-primary-hover hover:underline underline-offset-2 cursor-pointer"
        >
          {expanded ? 'Show recent only' : `Show all ${ordered.length} events`}
        </button>
      )}
    </div>
  );
};

export default ActivityTimeline;
