import { useEffect, useRef } from 'react';
import { FiCheck, FiCornerUpLeft } from 'react-icons/fi';
import Avatar from '../Avatar';

export type RailStatus = 'completed' | 'current' | 'upcoming';

export interface RailStage {
  id: string;
  order: number;
  name: string;
  team?: string;
  /** Who did it (completed), who has it (current), or who did it last time (upcoming after a return). */
  person?: string;
  status: RailStatus;
  /** How many times work was sent back to this stage. */
  returns?: number;
}

interface StageRailProps {
  stages: RailStage[];
  /** The whole workflow is finished — the last node reads as done, not in progress. */
  finished?: boolean;
  label?: string;
}

const statusText: Record<RailStatus, string> = {
  completed: 'Completed',
  current: 'In progress',
  upcoming: 'Upcoming',
};

/**
 * The enquiry's journey as a rail: every stage in order, what is done, where it is
 * now, and who owns each step. It answers "where is this, who has it, what's
 * next" before anything else on the page is read.
 *
 * Built from HTML rather than SVG so names wrap, people's names stay selectable
 * text, and it scrolls sideways on a narrow screen with the current stage
 * brought into view.
 */
const StageRail = ({ stages, finished = false, label = 'Stage progression' }: StageRailProps) => {
  const currentRef = useRef<HTMLLIElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Bring the current stage into view inside the rail only — scrollIntoView would
  // also scroll the page, which is not what arriving on the screen should do.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const node = currentRef.current;
    if (!scroller || !node) return;
    const target = node.offsetLeft - scroller.clientWidth / 2 + node.clientWidth / 2;
    scroller.scrollLeft = Math.max(0, target);
  }, [stages]);

  if (stages.length === 0) return null;
  const doneCount = stages.filter((s) => s.status === 'completed').length;

  return (
    <div ref={scrollerRef} className="overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
      <ol aria-label={label} className="flex min-w-max">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;
          const nextDone = !isLast && stages[index + 1].status !== 'upcoming';
          const current = stage.status === 'current';
          const completed = stage.status === 'completed';
          return (
            <li
              key={stage.id}
              ref={current ? currentRef : undefined}
              data-stage={stage.id}
              data-status={stage.status}
              data-current={current ? 'true' : 'false'}
              className="relative w-[148px] shrink-0 px-2 pt-1"
            >
              {/* Connector to the next stage: solid once work has passed through it. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[19px] left-[calc(50%+18px)] right-[calc(-50%+18px)] h-[2px] ${
                    completed && nextDone
                      ? 'bg-success-strong'
                      : completed
                        ? 'bg-gradient-to-r from-success-strong to-primary'
                        : 'bg-[repeating-linear-gradient(90deg,#CFD4E0_0_4px,transparent_4px_8px)]'
                  }`}
                />
              )}

              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className={`relative z-[1] h-9 w-9 rounded-full flex items-center justify-center text-meta font-semibold tabular
                      ${completed ? 'bg-success-strong text-white' : ''}
                      ${current ? 'bg-primary text-white ring-4 ring-primary-soft stage-halo' : ''}
                      ${stage.status === 'upcoming' ? 'bg-surface text-ink-subtle border-2 border-line-strong' : ''}`}
                  >
                    {completed ? <FiCheck className="text-[16px]" strokeWidth={3} /> : stage.order}
                  </span>
                  {(stage.returns ?? 0) > 0 && (
                    <span
                      className="absolute -top-1.5 -right-3 z-[2] inline-flex items-center gap-0.5 h-[18px] px-1 rounded-full
                        bg-warning-subtle text-warning ring-1 ring-warning-border text-[10px] font-semibold"
                      title={`Sent back here ${stage.returns} time${stage.returns === 1 ? '' : 's'}`}
                    >
                      <FiCornerUpLeft aria-hidden="true" />
                      {stage.returns}
                    </span>
                  )}
                </div>

                <p
                  className={`mt-2.5 text-meta font-semibold leading-4 line-clamp-2 min-h-[32px] ${
                    current ? 'text-primary' : completed ? 'text-ink' : 'text-ink-muted'
                  }`}
                  title={stage.name}
                >
                  {stage.name}
                </p>
                {stage.team && <p className="mt-0.5 text-[11px] leading-4 text-ink-subtle truncate max-w-full">{stage.team}</p>}
                <div className="mt-1.5 h-6 flex items-center justify-center max-w-full">
                  {stage.person ? (
                    <span
                      className={`inline-flex items-center gap-1.5 max-w-full h-6 pl-0.5 pr-2 rounded-full text-[11px] font-medium ${
                        current ? 'bg-primary-subtle text-primary' : 'text-ink-muted'
                      }`}
                    >
                      <Avatar name={stage.person} size="xs" />
                      <span className="truncate">{stage.person}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-subtle">{current && !finished ? 'Unassigned' : ''}</span>
                  )}
                </div>
                <span className="sr-only">
                  Stage {stage.order}, {stage.name}: {finished && current ? 'Completed' : statusText[stage.status]}
                  {stage.person ? `, ${stage.person}` : ''}
                  {stage.returns ? `, sent back here ${stage.returns} times` : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="sr-only">
        {doneCount} of {stages.length} stages complete.
      </p>
    </div>
  );
};

export default StageRail;
