import { FiArrowDown, FiArrowUp, FiCheckCircle, FiEdit2, FiGitMerge, FiPlus, FiX } from 'react-icons/fi';
import { Team } from '../../types';
import { DraftStage, moveStage } from '../../utils/stageSync';
import { inputClass } from '../../utils/formStyles';
import Field from '../Field';
import Button, { IconButton } from '../Button';
import WorkflowMap from '../flow/WorkflowMap';
import { TEAM_FALLBACK, teamColors } from '../../utils/theme';

type Draft = DraftStage & { tempId: number };

interface WorkflowStagesStepProps {
  workflowName: string;
  onWorkflowNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;

  teams: Team[];
  stageForm: Draft;
  onStageFormChange: (stage: Draft) => void;
  onAddStage: () => void;

  stages: Draft[];
  onStagesChange: (stages: Draft[]) => void;
  editingStageIndex: number | null;
  onEditStage: (index: number) => void;

  onCreateWorkflow: () => void;
  loading: boolean;
  createdWorkflowId: string | null;
}

/**
 * Step 4 of the wizard: name the workflow and build its ordered stages, with the
 * swimlane map drawing itself as stages are added — so the shape of the process
 * (and every hand-off between teams) is visible before it is saved.
 */
const WorkflowStagesStep = ({
  workflowName,
  onWorkflowNameChange,
  description,
  onDescriptionChange,
  teams,
  stageForm,
  onStageFormChange,
  onAddStage,
  stages,
  onStagesChange,
  editingStageIndex,
  onEditStage,
  onCreateWorkflow,
  loading,
  createdWorkflowId,
}: WorkflowStagesStepProps) => {
  const teamName = (id: string) => teams.find((t) => t.teamId === id)?.teamName;
  const colors = teamColors(stages.map((s) => ({ teamId: s.teamId, stageOrder: s.stageOrder })));
  const locked = Boolean(createdWorkflowId);

  return (
    <div>
      <h2 className="text-title font-semibold text-ink">Create Workflow</h2>
      <p className="mt-1 text-body text-ink-muted">
        Name it, then add stages in the order an enquiry moves through them. Each stage is owned by one team.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field htmlFor="wf-name" label="Workflow name" required>
          <input
            id="wf-name"
            type="text"
            value={workflowName}
            onChange={(e) => onWorkflowNameChange(e.target.value)}
            className={inputClass}
            placeholder="e.g. Quotation Preparation"
            disabled={locked}
            required
          />
        </Field>
        <Field htmlFor="wf-description" label="Description" hint="Optional">
          <input
            id="wf-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className={inputClass}
            placeholder="What the workflow is for"
            disabled={locked}
          />
        </Field>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
        <div>
          <p className="eyebrow mb-3">Stages · {stages.length}</p>

          {!locked && (
            <form
              className="rounded-card border border-dashed border-primary-border bg-primary-subtle/40 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                onAddStage();
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)] gap-2">
                <div>
                  <label htmlFor="stage-name" className="sr-only">Stage name</label>
                  <input
                    id="stage-name"
                    type="text"
                    value={stageForm.stageName}
                    onChange={(e) => onStageFormChange({ ...stageForm, stageName: e.target.value })}
                    className={inputClass}
                    placeholder={editingStageIndex !== null ? 'Stage name' : `Stage ${stages.length + 1} name, e.g. Site Visit`}
                  />
                </div>
                <div>
                  <label htmlFor="stage-team" className="sr-only">Owning team</label>
                  <select
                    id="stage-team"
                    value={stageForm.teamId || ''}
                    onChange={(e) => onStageFormChange({ ...stageForm, teamId: e.target.value || '' })}
                    className={inputClass}
                  >
                    <option value="">Owning team…</option>
                    {teams.map((team) => (
                      <option key={team.teamId} value={team.teamId}>
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-meta text-ink-subtle">Press Enter to add.</p>
                <Button type="submit" size="sm" variant="primary" icon={editingStageIndex !== null ? <FiEdit2 /> : <FiPlus />} disabled={!stageForm.stageName.trim()}>
                  {editingStageIndex !== null ? 'Update Stage' : 'Add Stage'}
                </Button>
              </div>
            </form>
          )}

          {stages.length > 0 && (
            <ol className="mt-3 rounded-card border border-line divide-y divide-line-subtle bg-surface">
              {stages.map((stage, index) => (
                <li
                  key={stage.tempId || index}
                  className={`flex items-center gap-3 pl-3 pr-1.5 py-2 ${editingStageIndex === index ? 'bg-primary-subtle' : ''}`}
                >
                  <span className="font-mono text-meta text-ink-subtle w-6 tabular">{String(stage.stageOrder).padStart(2, '0')}</span>
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: (stage.teamId && colors.get(stage.teamId)) || TEAM_FALLBACK }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-ink truncate">{stage.stageName}</p>
                    <p className="text-meta text-ink-subtle truncate">{teamName(stage.teamId) ?? 'No team yet'}</p>
                  </div>
                  {!locked && (
                    <div className="flex items-center">
                      <IconButton size="sm" label={`Move stage ${index + 1} up`} icon={<FiArrowUp />} disabled={index === 0} onClick={() => onStagesChange(moveStage(stages, index, index - 1))} />
                      <IconButton size="sm" label={`Move stage ${index + 1} down`} icon={<FiArrowDown />} disabled={index === stages.length - 1} onClick={() => onStagesChange(moveStage(stages, index, index + 1))} />
                      <IconButton size="sm" label={`Edit stage ${index + 1}`} icon={<FiEdit2 />} onClick={() => onEditStage(index)} />
                      <IconButton
                        size="sm"
                        tone="danger"
                        label={`Remove stage ${index + 1}`}
                        icon={<FiX />}
                        onClick={() =>
                          onStagesChange(stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, stageOrder: i + 1 })))
                        }
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {!locked ? (
            <Button
              className="mt-4 w-full"
              variant="primary"
              onClick={onCreateWorkflow}
              loading={loading}
              disabled={!workflowName.trim() || stages.length === 0}
              icon={<FiGitMerge />}
            >
              {loading ? 'Creating…' : 'Create Workflow'}
            </Button>
          ) : (
            <div role="status" className="mt-4 flex items-center gap-2.5 px-3 py-2.5 rounded-card bg-success-subtle border border-success-border text-body text-success">
              <FiCheckCircle aria-hidden="true" className="shrink-0" />
              Workflow created. Continue to set its SLA.
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="eyebrow mb-3">Preview</p>
          {stages.length > 0 ? (
            <WorkflowMap
              compact
              label="Workflow preview"
              stages={stages.map((s, i) => ({
                id: String(s.tempId || i),
                order: s.stageOrder,
                name: s.stageName,
                teamId: s.teamId || undefined,
                teamName: teamName(s.teamId),
              }))}
            />
          ) : (
            <div className="h-48 rounded-card border border-dashed border-line-strong bg-surface-muted flex flex-col items-center justify-center text-center px-6">
              <FiGitMerge aria-hidden="true" className="text-[22px] text-ink-subtle mb-2" />
              <p className="text-body font-medium text-ink-muted">The flow draws itself here</p>
              <p className="text-meta text-ink-subtle">Add a stage and pick its team to see the lanes and hand-offs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowStagesStep;
