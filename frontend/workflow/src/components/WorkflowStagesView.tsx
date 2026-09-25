import { useMemo } from 'react';
import { FiCornerDownRight, FiUserCheck } from 'react-icons/fi';
import { Workflow } from '../types';
import { getStageForm, hasStageForm } from '../utils/stageFormRegistry';
import { autoRoutingReason } from '../utils/stageRouting';
import { TEAM_FALLBACK, teamColors } from '../utils/theme';

interface WorkflowStagesViewProps {
  workflow: Workflow;
  /** Highlights one stage, e.g. the one picked on the map. */
  selectedId?: string | null;
  onSelect?: (stageId: string) => void;
}

/**
 * The workflow as a readable table of stages: who owns each one, what it records,
 * and how the work reaches the next team. It is the text companion to the map —
 * everything the diagram shows by position is written out here.
 */
const WorkflowStagesView = ({ workflow, selectedId, onSelect }: WorkflowStagesViewProps) => {
  const stages = useMemo(
    () => [...(workflow.stages || [])].sort((a, b) => a.stageOrder - b.stageOrder),
    [workflow.stages]
  );
  const colors = useMemo(() => teamColors(stages), [stages]);
  const uniqueTeams = new Set(stages.map((s) => s.teamName).filter(Boolean)).size;

  return (
    <div className="font-sans">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-3 border-b border-line-subtle text-meta text-ink-subtle">
        <span><span className="font-semibold text-ink tabular">{stages.length}</span> Total Stages</span>
        <span><span className="font-semibold text-ink tabular">{uniqueTeams}</span> Unique Teams</span>
      </div>
      <ol className="divide-y divide-line-subtle">
        {stages.map((stage) => {
          const schema = getStageForm(stage.stageName);
          const custom = hasStageForm(stage.stageName);
          const tableField = schema.fields.find((f) => f.type === 'table');
          const next = stages.find((s) => s.stageOrder > stage.stageOrder);
          const routing = autoRoutingReason(next, stages);
          const selected = selectedId === stage.stageId;
          const color = colors.get(stage.teamId) ?? TEAM_FALLBACK;
          return (
            <li
              key={stage.stageId}
              className={`grid grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[2.5rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 gap-y-1 px-5 py-3.5
                ${selected ? 'bg-primary-subtle' : onSelect ? 'hover:bg-surface-muted' : ''} ${onSelect ? 'cursor-pointer' : ''}`}
              onClick={onSelect ? () => onSelect(stage.stageId) : undefined}
            >
              <span className={`font-mono text-meta tabular pt-0.5 ${selected ? 'text-primary font-semibold' : 'text-ink-subtle'}`}>
                {String(stage.stageOrder).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="text-body font-semibold text-ink">{stage.stageName}</h3>
                <p className="text-meta text-ink-subtle md:hidden">{stage.teamName || 'No team'}</p>
              </div>
              <div className="hidden md:flex items-center gap-2 min-w-0 text-body text-ink-muted">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate">{stage.teamName || 'No team'}</span>
              </div>
              <div className="col-start-2 md:col-start-auto min-w-0 text-meta text-ink-muted space-y-0.5">
                <p>
                  {custom ? `${schema.fields.length} field${schema.fields.length === 1 ? '' : 's'}` : 'Notes only'}
                  {tableField ? ` · ${tableField.label.toLowerCase()}` : ''}
                </p>
                {next && (
                  <p className="inline-flex items-start gap-1.5 text-ink-subtle">
                    {routing ? (
                      <FiUserCheck aria-hidden="true" className="mt-0.5 shrink-0" />
                    ) : (
                      <FiCornerDownRight aria-hidden="true" className="mt-0.5 shrink-0" />
                    )}
                    <span>
                      <span className="font-medium text-ink-muted">{next.stageName}</span>
                      {routing ? ` ${routing}` : ' — assignee chosen at hand-over'}
                    </span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default WorkflowStagesView;
