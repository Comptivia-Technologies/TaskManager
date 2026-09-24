import { FiCheck } from 'react-icons/fi';

export interface WizardStep {
  label: string;
  /** Short line under the label, e.g. "Optional". */
  hint?: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  /** 1-based. */
  current: number;
  completed: number[];
  /** Only completed steps and the current one can be revisited. */
  onStepClick?: (step: number) => void;
}

/**
 * The steps of a multi-step setup as a labelled rail across the top: done, here,
 * and still to come — so nobody has to guess how much is left. Uses the same
 * node language as the enquiry stage rail.
 */
const WizardStepper = ({ steps, current, completed, onStepClick }: WizardStepperProps) => (
  <nav aria-label="Setup progress" className="overflow-x-auto scrollbar-none">
    <ol className="flex min-w-max sm:min-w-0">
      {steps.map((step, index) => {
        const n = index + 1;
        const done = completed.includes(n) && n !== current;
        const active = n === current;
        const reachable = done || active;
        const isLast = n === steps.length;
        return (
          <li key={step.label} className="relative flex-1 min-w-[120px]">
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute top-4 left-[calc(50%+22px)] right-[calc(-50%+22px)] h-[2px] rounded-full ${
                  done ? 'bg-success-strong' : 'bg-line'
                }`}
              />
            )}
            <button
              type="button"
              disabled={!reachable || !onStepClick}
              onClick={() => onStepClick?.(n)}
              aria-current={active ? 'step' : undefined}
              className="group relative w-full flex flex-col items-center gap-2 px-2 cursor-pointer disabled:cursor-default"
            >
              <span
                className={`relative z-[1] h-8 w-8 rounded-full flex items-center justify-center text-meta font-semibold tabular
                  ${done ? 'bg-success-strong text-white group-hover:brightness-110' : ''}
                  ${active ? 'bg-primary text-white ring-4 ring-primary-soft' : ''}
                  ${!done && !active ? 'bg-surface text-ink-subtle border-2 border-line-strong' : ''}`}
              >
                {done ? <FiCheck aria-hidden="true" className="text-[15px]" strokeWidth={3} /> : n}
              </span>
              <span className="text-center leading-tight">
                <span className={`block text-meta font-semibold ${active ? 'text-ink' : done ? 'text-ink-muted' : 'text-ink-subtle'}`}>
                  {step.label}
                </span>
                {step.hint && <span className="block text-[11px] text-ink-subtle">{step.hint}</span>}
              </span>
              <span className="sr-only">{done ? '(completed)' : active ? '(current step)' : '(not started)'}</span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);

export default WizardStepper;
