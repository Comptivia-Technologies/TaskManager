import EmptyState from '../components/EmptyState';
import Button, { IconButton } from '../components/Button';
import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import FlowStrip from '../components/flow/FlowStrip';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkflows } from '../hooks/useWorkflows';
import { workflowService } from '../services/workflowService';
import { Workflow } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiArrowRight, FiClock, FiEdit2, FiGitMerge, FiPlus, FiRepeat, FiSliders, FiTrash2, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import WorkflowWizard from '../components/WorkflowWizard';
import WorkflowEdit from '../components/WorkflowEdit';
import SLAConfigure from '../components/SLAConfigure';
import { apiErrorMessage } from '../utils/apiError';
import { formatDateOnlyIST } from '../utils/dateUtils';
import { countHandoffs, countTeams } from '../utils/workflowStats';

const Workflows = () => {
  const { workflows, loading, refetch } = useWorkflows();
  const location = useLocation();
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [isSLAConfigureMode, setIsSLAConfigureMode] = useState(false);
  const [selectedWorkflowForSLA, setSelectedWorkflowForSLA] = useState<string | undefined>(undefined);
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  // The detail screen links here to edit, since editing lives with the list.
  const editRequest = (location.state as { edit?: string } | null)?.edit;
  useEffect(() => {
    if (!editRequest || loading) return;
    const target = workflows.find((w) => w.workflowId === editRequest);
    if (target) setEditingWorkflow(target);
    navigate(location.pathname, { replace: true, state: null });
  }, [editRequest, loading, workflows, navigate, location.pathname]);

  const handleDeleteWorkflow = async (workflow: Workflow) => {
    setDeleting(true);
    try {
      await workflowService.delete(workflow.workflowId);
      toast.success('Workflow deleted successfully');
      setWorkflowToDelete(null);
      refetch();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to delete workflow'));
    } finally {
      setDeleting(false);
    }
  };

  const handleWizardSuccess = (workflowId: string) => {
    setIsWizardMode(false);
    refetch();
    navigate(`/workflows/${workflowId}`);
  };

  const handleEditSuccess = () => {
    setEditingWorkflow(null);
    refetch();
  };

  const handleSLASuccess = () => {
    setIsSLAConfigureMode(false);
    setSelectedWorkflowForSLA(undefined);
    refetch();
  };

  if (loading) {
    return <LoadingSpinner label="Loading workflows" />;
  }

  if (isWizardMode) {
    return (
      <WorkflowWizard
        onSuccess={handleWizardSuccess}
        onCancel={() => setIsWizardMode(false)}
      />
    );
  }

  if (isSLAConfigureMode) {
    return (
      <SLAConfigure
        onSuccess={handleSLASuccess}
        onCancel={() => {
          setIsSLAConfigureMode(false);
          setSelectedWorkflowForSLA(undefined);
        }}
        initialWorkflowId={selectedWorkflowForSLA}
      />
    );
  }

  if (editingWorkflow) {
    return (
      <WorkflowEdit
        workflow={editingWorkflow}
        onSuccess={handleEditSuccess}
        onCancel={() => setEditingWorkflow(null)}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Workflows"
        subtitle="The stage sequence every enquiry follows, and which team owns each step."
        actions={
          <>
            {workflows.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  icon={<FiClock />}
                  onClick={() => {
                    setSelectedWorkflowForSLA(workflows.length === 1 ? workflows[0].workflowId : undefined);
                    setIsSLAConfigureMode(true);
                  }}
                >
                  Configure SLA
                </Button>
                <Button variant="secondary" icon={<FiSliders />} onClick={() => navigate('/priority-rules')}>
                  Priority Rules
                </Button>
              </>
            )}
            <Button variant="primary" icon={<FiPlus />} onClick={() => setIsWizardMode(true)}>
              {workflows.length === 0 ? 'Get Started' : 'Create Workflow'}
            </Button>
          </>
        }
      />

      {workflows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FiGitMerge />}
            title="No workflows yet"
            body="A workflow is the ordered list of stages an enquiry moves through, each owned by a team. Create one to start registering work."
            action={
              <Button variant="primary" icon={<FiPlus />} onClick={() => setIsWizardMode(true)}>
                Get Started
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {workflows.map((workflow) => {
            const stages = workflow.stages ?? [];
            const stats = [
              { icon: <FiGitMerge />, label: `${stages.length} stage${stages.length === 1 ? '' : 's'}` },
              { icon: <FiUsers />, label: `${countTeams(workflow)} team${countTeams(workflow) === 1 ? '' : 's'}` },
              { icon: <FiRepeat />, label: `${countHandoffs(workflow)} hand-off${countHandoffs(workflow) === 1 ? '' : 's'}` },
            ];
            return (
              <li key={workflow.workflowId}>
                <article
                  data-workflow-card
                  className="group card hover:border-line-strong hover:shadow-azure-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/workflows/${workflow.workflowId}`)}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-10 gap-y-5 px-6 py-5">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="mt-0.5 h-10 w-10 shrink-0 rounded-card bg-primary-subtle text-primary ring-1 ring-inset ring-primary-border flex items-center justify-center text-[18px]">
                          <FiGitMerge />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-title font-semibold text-ink group-hover:text-primary transition-colors">
                            {workflow.workflowName}
                          </h2>
                          <p className="mt-0.5 text-body text-ink-muted line-clamp-2">
                            {workflow.description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-subtle">
                        {stats.map((s) => (
                          <span key={s.label} className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true">{s.icon}</span>
                            {s.label}
                          </span>
                        ))}
                        <span>Created {formatDateOnlyIST(workflow.createdAt)}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                      <p className="eyebrow mb-3">Stage flow</p>
                      <FlowStrip stages={stages} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-6 py-2.5 border-t border-line-subtle bg-surface-muted rounded-b-card">
                    <span className="inline-flex items-center gap-1.5 text-meta font-medium text-primary">
                      Open workflow
                      <FiArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <IconButton label={`Edit ${workflow.workflowName}`} icon={<FiEdit2 />} size="sm" onClick={() => setEditingWorkflow(workflow)} />
                      <IconButton label={`Delete ${workflow.workflowName}`} icon={<FiTrash2 />} size="sm" tone="danger" onClick={() => setWorkflowToDelete(workflow)} />
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={Boolean(workflowToDelete)}
        title="Delete workflow"
        body={
          <>
            Delete <span className="font-medium text-ink">{workflowToDelete?.workflowName}</span> and its{' '}
            {workflowToDelete?.stages?.length ?? 0} stages?
          </>
        }
        confirmLabel="Delete workflow"
        busy={deleting}
        onCancel={() => setWorkflowToDelete(null)}
        onConfirm={() => workflowToDelete && handleDeleteWorkflow(workflowToDelete)}
      />
    </div>
  );
};

export default Workflows;
