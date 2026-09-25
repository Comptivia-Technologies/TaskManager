import Button, { IconButton } from '../components/Button';
import Field from './Field';
import PageHeader from './PageHeader';
import WorkflowMap from './flow/WorkflowMap';
import { moveStage, syncStages } from '../utils/stageSync';
import { inputClass } from '../utils/formStyles';
import { useState, useEffect } from 'react';
import { useTeams } from '../hooks/useTeams';
import { workflowService } from '../services/workflowService';
import { Workflow, WorkflowUpdate } from '../types';
import { toast } from 'react-toastify';
import { FiArrowDown, FiArrowUp, FiCheck, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { apiErrorMessage } from '../utils/apiError';
import { TEAM_FALLBACK, teamColors } from '../utils/theme';

interface WorkflowEditProps {
  workflow: Workflow;
  onSuccess: () => void;
  onCancel: () => void;
}

interface StageForm {
  stageId?: string; // Existing stages keep their id; new ones have none until saved.
  tempId?: number; // Stable key for a stage that has not been saved yet.
  stageName: string;
  stageOrder: number;
  teamId: string;
  teamName?: string;
  stageType?: 'Process' | 'Escalation';
  transitionPolicy?: 'OnComplete' | 'OnTimeout' | 'Manual';
  timeoutMinutes?: number;
}

/**
 * Edit a workflow's name, description and stages. Stages are edited in place —
 * rename, re-team, reorder, remove — with the swimlane preview redrawing as you
 * go. Nothing is written until Save, which syncs the whole list in one pass.
 */
const WorkflowEdit = ({ workflow, onSuccess, onCancel }: WorkflowEditProps) => {
  const { teams } = useTeams();
  const [workflowName, setWorkflowName] = useState(workflow.workflowName);
  const [description, setDescription] = useState(workflow.description || '');
  const [stages, setStages] = useState<StageForm[]>([]);
  const [nextTempId, setNextTempId] = useState(1);
  const [newStageName, setNewStageName] = useState('');
  const [newStageTeam, setNewStageTeam] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWorkflowName(workflow.workflowName);
    setDescription(workflow.description || '');
    const existingStages: StageForm[] = [...(workflow.stages || [])]
      .sort((a, b) => a.stageOrder - b.stageOrder)
      .map((stage) => ({
        stageId: stage.stageId,
        stageName: stage.stageName,
        stageOrder: stage.stageOrder,
        teamId: stage.teamId,
        teamName: stage.teamName,
        stageType: stage.stageType || 'Process',
        transitionPolicy: stage.transitionPolicy || 'OnComplete',
        timeoutMinutes: stage.timeoutMinutes,
      }));
    setStages(existingStages);
    setNextTempId(1);
  }, [workflow]);

  const updateStage = (index: number, patch: Partial<StageForm>) =>
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const handleAddStage = () => {
    if (!newStageName.trim()) {
      toast.error('Please enter a stage name');
      return;
    }
    if (!newStageTeam) {
      toast.error('Please select a team for the stage');
      return;
    }
    setStages([
      ...stages,
      { tempId: nextTempId, stageName: newStageName.trim(), stageOrder: stages.length + 1, teamId: newStageTeam },
    ]);
    setNextTempId(nextTempId + 1);
    setNewStageName('');
  };

  const handleDeleteStage = (index: number) =>
    setStages(stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, stageOrder: i + 1 })));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    if (stages.length === 0) {
      toast.error('Please add at least one stage');
      return;
    }

    if (stages.some((s) => !s.stageName.trim())) {
      toast.error('Every stage needs a name');
      return;
    }

    if (stages.some((s) => !s.teamId)) {
      toast.error('Please assign a team to all stages');
      return;
    }

    setLoading(true);
    try {
      const updateData: WorkflowUpdate = {
        workflowName: workflowName.trim(),
        description: description.trim() || undefined,
      };

      await workflowService.update(workflow.workflowId, updateData);

      await syncStages(workflow.workflowId, stages, workflow.stages || []);

      try {
        await workflowService.updateJson(workflow.workflowId);
      } catch (error) {
        console.warn('Failed to update workflow JSON:', error);
      }

      toast.success('Workflow updated successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to update workflow'));
    } finally {
      setLoading(false);
    }
  };

  const colors = teamColors(stages.map((s) => ({ teamId: s.teamId, stageOrder: s.stageOrder })));
  const teamName = (id: string) => teams.find((t) => t.teamId === id)?.teamName;

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        breadcrumbs={[{ label: 'Workflows', onClick: onCancel }]}
        title="Edit Workflow"
        subtitle={workflow.workflowName}
        actions={
          <>
            <Button variant="ghost" icon={<FiX />} onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon={<FiCheck />} loading={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
        <div className="space-y-6">
          <section className="card px-5 py-5 space-y-4">
            <Field htmlFor="edit-wf-name" label="Workflow name" required>
              <input
                id="edit-wf-name"
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className={inputClass}
                placeholder="Enter workflow name"
                required
              />
            </Field>
            <Field htmlFor="edit-wf-desc" label="Description" hint="Optional">
              <textarea
                id="edit-wf-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                rows={3}
                placeholder="What the workflow is for"
              />
            </Field>
          </section>

          <section className="card overflow-hidden" aria-labelledby="edit-stages-title">
            <header className="flex items-center justify-between px-5 py-3 border-b border-line-subtle">
              <h2 id="edit-stages-title" className="text-title font-semibold text-ink">Stages</h2>
              <span className="text-meta text-ink-subtle tabular">{stages.length} in order</span>
            </header>
            <ol className="divide-y divide-line-subtle">
              {stages.map((stage, index) => (
                <li key={stage.stageId || `new-${stage.tempId}`} className="flex items-center gap-2 pl-4 pr-2 py-2.5">
                  <span className="font-mono text-meta text-ink-subtle w-6 tabular shrink-0">{String(index + 1).padStart(2, '0')}</span>
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: (stage.teamId && colors.get(stage.teamId)) || TEAM_FALLBACK }}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      aria-label={`Stage ${index + 1} name`}
                      value={stage.stageName}
                      onChange={(e) => updateStage(index, { stageName: e.target.value })}
                      className={`${inputClass} min-h-[36px] py-1.5`}
                    />
                    <select
                      aria-label={`Stage ${index + 1} team`}
                      value={stage.teamId || ''}
                      onChange={(e) => updateStage(index, { teamId: e.target.value })}
                      className={`${inputClass} min-h-[36px] py-1.5`}
                    >
                      <option value="">Select team…</option>
                      {teams.map((team) => (
                        <option key={team.teamId} value={team.teamId}>
                          {team.teamName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center shrink-0">
                    <IconButton size="sm" label={`Move stage ${index + 1} up`} icon={<FiArrowUp />} disabled={index === 0} onClick={() => setStages(moveStage(stages, index, index - 1))} />
                    <IconButton size="sm" label={`Move stage ${index + 1} down`} icon={<FiArrowDown />} disabled={index === stages.length - 1} onClick={() => setStages(moveStage(stages, index, index + 1))} />
                    <IconButton size="sm" tone="danger" label={`Delete stage ${index + 1}`} icon={<FiTrash2 />} onClick={() => handleDeleteStage(index)} />
                  </div>
                </li>
              ))}
            </ol>
            <div className="px-4 py-3 border-t border-line bg-surface-muted">
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_10rem_auto] gap-2">
                <input
                  type="text"
                  aria-label="New stage name"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStage();
                    }
                  }}
                  placeholder="New stage name"
                  className={inputClass}
                />
                <select
                  aria-label="New stage team"
                  value={newStageTeam}
                  onChange={(e) => setNewStageTeam(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Team…</option>
                  {teams.map((team) => (
                    <option key={team.teamId} value={team.teamId}>
                      {team.teamName}
                    </option>
                  ))}
                </select>
                <Button icon={<FiPlus />} onClick={handleAddStage}>
                  Add Stage
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="min-w-0 xl:sticky xl:top-6">
          <p className="eyebrow mb-3">Preview</p>
          {stages.length > 0 ? (
            <WorkflowMap
              compact
              label="Workflow preview"
              stages={stages.map((s, i) => ({
                id: s.stageId || `new-${s.tempId}`,
                order: i + 1,
                name: s.stageName || 'Untitled stage',
                teamId: s.teamId || undefined,
                teamName: teamName(s.teamId) ?? s.teamName,
              }))}
            />
          ) : (
            <div className="h-48 rounded-card border border-dashed border-line-strong bg-surface-muted flex items-center justify-center text-meta text-ink-subtle">
              Add a stage to see the flow.
            </div>
          )}
          <p className="mt-2 text-meta text-ink-subtle">Changes are saved together when you press Save changes.</p>
        </div>
      </div>
    </form>
  );
};

export default WorkflowEdit;
