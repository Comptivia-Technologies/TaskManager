import Modal from '../components/Modal';
import Button, { IconButton } from '../components/Button';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import Field from '../components/Field';
import { inputClass } from '../utils/formStyles';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCornerUpLeft,
  FiDownload,
  FiFileText,
  FiGitBranch,
  FiPaperclip,
  FiUpload,
  FiUser,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import StageForm, { extractNominations, missingRequiredFields, prefillTables } from '../components/StageForm';
import StageAssigneePicker, { AUTO_ASSIGN } from '../components/StageAssigneePicker';
import StageValues from '../components/StageValues';
import TaskHistoryGraph, { resolveCurrentStageId } from '../components/TaskHistoryGraph';
import StageRail, { RailStage } from '../components/flow/StageRail';
import ActivityTimeline from '../components/flow/ActivityTimeline';
import Avatar from '../components/Avatar';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/taskService';
import { workflowService } from '../services/workflowService';
import { Stage, Task, TaskAttachment, TaskStageData, TaskStageHistory, Workflow } from '../types';
import { StageFormValues } from '../types/stageForms';
import { formatDateToIST, relativeDue, timeAgo } from '../utils/dateUtils';
import { PERMISSIONS, hasPermission } from '../utils/roleUtils';
import { getStageForm, stageFieldLabels } from '../utils/stageFormRegistry';
import { autoRoutingReason } from '../utils/stageRouting';
import { apiErrorMessage } from '../utils/apiError';
import { parseJsonObject } from '../utils/json';
import { humanizeStatus, priorityTone, statusTone } from '../utils/status';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileExt = (name: string) => (name.includes('.') ? name.split('.').pop()!.slice(0, 4).toUpperCase() : 'FILE');

const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentMember, permissions } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [history, setHistory] = useState<TaskStageHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnStageId, setReturnStageId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState<{ stage?: string; reason?: string }>({});
  const [stageData, setStageData] = useState<TaskStageData[]>([]);
  const [formValues, setFormValues] = useState<StageFormValues>({});
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [nextAssignee, setNextAssignee] = useState(AUTO_ASSIGN);
  const [nextStageBlocked, setNextStageBlocked] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [routeOpen, setRouteOpen] = useState(false);

  const load = useCallback(async (): Promise<TaskStageHistory[]> => {
    if (!id) return [];
    const taskData = await taskService.getById(id);
    const [workflowResult, historyData, stageDataRows, attachmentRows] = await Promise.all([
      workflowService.getById(taskData.workflowId).catch(() => null),
      taskService.getHistory(id).catch(() => [] as TaskStageHistory[]),
      taskService.getStageData(id).catch(() => [] as TaskStageData[]),
      taskService.getAttachments(id).catch(() => [] as TaskAttachment[]),
    ]);
    let workflowData = workflowResult;
    if (workflowData && (!workflowData.stages || workflowData.stages.length === 0)) {
      const stageRows = await workflowService.getStages(taskData.workflowId).catch(() => []);
      workflowData = { ...workflowData, stages: stageRows as Stage[] };
    }
    setTask(taskData);
    setWorkflow(workflowData);
    setHistory(historyData);
    setStageData(stageDataRows);
    setAttachments(attachmentRows);
    // Work sent back reopens a stage that was already filled in, so the previous
    // submission is restored rather than the author starting from a blank form.
    const alreadySubmitted = stageDataRows.find((row) => row.stageId === taskData.stageId);
    // The first stage is filled in when the enquiry is registered, and that lands on
    // the task itself rather than as a stage submission. Without this it would ask
    // for everything a second time.
    const firstStageId = [...(workflowData?.stages ?? [])]
      .sort((a, b) => a.stageOrder - b.stageOrder)[0]?.stageId;
    const intakeValues =
      taskData.stageId && taskData.stageId === firstStageId ? parseJsonObject(taskData.dataJson) : {};

    const startingValues = (
      alreadySubmitted ? parseJsonObject(alreadySubmitted.dataJson) : intakeValues
    ) as StageFormValues;

    // Tables that continue an earlier stage's list start from that list, so
    // procurement prices the engineer's items instead of retyping them.
    const currentStageName = (workflowData?.stages ?? []).find(
      (stage) => stage.stageId === taskData.stageId
    )?.stageName;
    const submittedByStageName = (workflowData?.stages ?? []).reduce<Record<string, Record<string, unknown>>>(
      (byName, stage) => {
        const row = stageDataRows.find((data) => data.stageId === stage.stageId);
        return row ? { ...byName, [stage.stageName.trim().toLowerCase()]: parseJsonObject(row.dataJson) } : byName;
      },
      {}
    );

    setFormValues(prefillTables(getStageForm(currentStageName), startingValues, submittedByStageName));
    return historyData;
  }, [id]);

  useEffect(() => {
    const initialLoad = async () => {
      try {
        setLoading(true);
        await load();
      } catch (error) {
        toast.error('Failed to load task');
        navigate('/enquiry');
      } finally {
        setLoading(false);
      }
    };
    initialLoad();
  }, [load, navigate]);

  // Stage transitions are driven by events, so the change lands a moment after the
  // request returns. Re-read until a new history row appears rather than leaving
  // the screen looking as though nothing happened.
  const reloadUntilAdvanced = async (previousCount: number) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      try {
        const rows = await load();
        if (rows.length > previousCount) return;
      } catch {
        // keep trying; the final state still renders from the last good read
      }
    }
  };

  const runAction = async (action: () => Promise<void>, successMessage: string, failureMessage: string) => {
    const previousCount = history.length;
    setSubmitting(true);
    try {
      await action();
      toast.success(successMessage);
      await reloadUntilAdvanced(previousCount);
    } catch (error: any) {
      toast.error(apiErrorMessage(error, failureMessage));
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = (schema: ReturnType<typeof getStageForm>) => {
    const missing = missingRequiredFields(schema, formValues);
    setMissingFields(missing);
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.join(', ')}`);
      document.getElementById('stage-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Appointments for later stages are submitted separately from the form answers.
    const nominations = extractNominations(schema, formValues, stages);
    return runAction(
      () => taskService.completeStage(id!, formValues, nextAssignee || undefined, nominations),
      'Stage completed.',
      'Could not complete this stage.'
    );
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing the input lets the same file be picked again after a failure.
    event.target.value = '';
    if (!file || !id) return;

    setUploading(true);
    try {
      await taskService.uploadAttachment(id, file);
      setAttachments(await taskService.getAttachments(id));
      toast.success(`${file.name} attached.`);
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Could not upload that file.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: TaskAttachment) => {
    try {
      await taskService.downloadAttachment(attachment.attachmentId, attachment.fileName);
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Could not download that file.'));
    }
  };

  const closeReturn = () => {
    setReturnOpen(false);
    setReturnError({});
  };

  const handleReturn = async () => {
    const errors = {
      stage: returnStageId ? undefined : 'Choose the stage to send this back to.',
      reason: returnReason.trim() ? undefined : 'Say what needs to change — whoever picks it up sees this.',
    };
    setReturnError(errors);
    if (errors.stage || errors.reason) return;
    await runAction(
      () => taskService.returnStage(id!, returnStageId, returnReason.trim()),
      'Sent back to the earlier stage.',
      'Could not send this back.'
    );
    setReturnOpen(false);
    setReturnStageId('');
    setReturnReason('');
  };

  if (loading) return <LoadingSpinner label="Loading enquiry" />;

  if (!task) {
    return (
      <div className="card">
        <EmptyState
          icon={<FiFileText />}
          title="Enquiry not found"
          body="It may have been removed, or the link is out of date."
          action={<Button onClick={() => navigate('/enquiry')}>Back to enquiries</Button>}
        />
      </div>
    );
  }

  const stages = [...(workflow?.stages || [])].sort((a, b) => a.stageOrder - b.stageOrder);
  const stageByName = task.stageName
    ? stages.find((stage) => stage.stageName.toLowerCase() === task.stageName!.toLowerCase())
    : undefined;
  const currentStageId = resolveCurrentStageId(
    stages.map((stage) => ({ id: stage.stageId, name: stage.stageName, order: stage.stageOrder })),
    history,
    task.stageId || stageByName?.stageId
  );
  const currentStage = stages.find((stage) => stage.stageId === currentStageId);
  const taskDone = /completed|done/i.test(task.status);
  const completerFor = (stageId: string) =>
    [...history]
      .reverse()
      .find((entry) => entry.action === 'Completed' && (entry.stageId === stageId || entry.fromStageId === stageId))
      ?.memberName;
  const assigneeFor = (stageId?: string) =>
    stageId
      ? [...history]
          .reverse()
          .find((entry) => entry.action === 'Assigned' && (entry.stageId === stageId || entry.toStageId === stageId))
          ?.memberName
      : undefined;
  const workingNow = task.assignedToMemberName || assigneeFor(currentStageId) || 'Unassigned';
  const isAssignee = Boolean(
    currentMember && task.assignedToMemberId && task.assignedToMemberId === currentMember.memberId
  );
  const canAct = isAssignee && !taskDone && Boolean(currentStage);
  const earlierStages = currentStage ? stages.filter((stage) => stage.stageOrder < currentStage.stageOrder) : [];
  const nextStage = currentStage ? stages.find((stage) => stage.stageOrder > currentStage.stageOrder) : undefined;
  // Some stages route themselves, so offering a choice would only let someone
  // override a decision that was already made.
  const autoRouting = autoRoutingReason(nextStage, stages);
  const canSeeProgression = hasPermission(permissions, PERMISSIONS.workflowsView);

  const currentSchema = getStageForm(currentStage?.stageName);
  const isFirstStage = Boolean(currentStage && stages[0] && currentStage.stageId === stages[0].stageId);
  const enquiryRecord = parseJsonObject(task.dataJson);
  const submittedForStage = (stageId: string) => parseJsonObject(stageData.find((row) => row.stageId === stageId)?.dataJson);

  const stageStatus = (stage: Stage): RailStage['status'] => {
    const isCurrent = stage.stageId === currentStageId;
    if (isCurrent && !taskDone) return 'current';
    if ((currentStage && stage.stageOrder < currentStage.stageOrder) || (taskDone && isCurrent)) return 'completed';
    return 'upcoming';
  };

  const returnsTo = (stageId: string) =>
    history.filter((entry) => entry.action === 'Returned' && entry.toStageId === stageId).length;
  const hasReturns = history.some((entry) => entry.action === 'Returned');

  const railStages: RailStage[] = stages.map((stage) => {
    const status = stageStatus(stage);
    return {
      id: stage.stageId,
      order: stage.stageOrder,
      name: stage.stageName,
      team: stage.teamName,
      status,
      returns: returnsTo(stage.stageId),
      person:
        status === 'current'
          ? task.assignedToMemberName || assigneeFor(stage.stageId)
          : completerFor(stage.stageId),
    };
  });

  const position = currentStage ? stages.findIndex((s) => s.stageId === currentStage.stageId) + 1 : 0;
  const due = relativeDue(task.dueDate);
  const submittedStages = stages.filter((stage) => stageData.some((row) => row.stageId === stage.stageId));
  const showEnquiryRecord = Object.keys(enquiryRecord).length > 0 && !isFirstStage;
  // The latest submission opens by default — unless it is the first stage, which
  // would only repeat the enquiry record shown just above it.
  const latest = submittedStages[submittedStages.length - 1];
  const lastSubmittedId = latest && !(showEnquiryRecord && latest.stageId === stages[0]?.stageId) ? latest.stageId : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Enquiries', to: '/enquiry' }]}
        title={task.taskName}
        badges={
          <>
            <Badge dot tone={statusTone(task.status, task.isOverdue)} icon={task.isOverdue ? <FiAlertCircle /> : undefined}>
              {task.isOverdue ? 'Overdue' : humanizeStatus(task.status)}
            </Badge>
            <Badge tone={priorityTone(task.priority)}>{task.priority} priority</Badge>
          </>
        }
        subtitle={task.description}
        meta={
          <>
            {stages.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <FiGitBranch aria-hidden="true" />
                {taskDone ? `All ${stages.length} stages complete` : `Stage ${position || '–'} of ${stages.length}`}
              </span>
            )}
            {due && !taskDone && (
              <span className={`inline-flex items-center gap-1.5 ${due.tone === 'danger' ? 'text-danger font-medium' : due.tone === 'warning' ? 'text-warning font-medium' : ''}`}>
                <FiClock aria-hidden="true" />
                {due.label}
              </span>
            )}
            {timeAgo(task.updatedAt || task.createdAt) && (
              <span className="inline-flex items-center gap-1.5">Updated {timeAgo(task.updatedAt || task.createdAt)}</span>
            )}
          </>
        }
      />

      {/* Where it is: the one thing every visitor to this page needs first. */}
      {canSeeProgression && stages.length > 0 && (
        <section aria-labelledby="progress-title" className="card px-5 pt-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 id="progress-title" className="text-title font-semibold text-ink">
                {taskDone ? 'Workflow complete' : currentStage ? currentStage.stageName : 'Progress'}
              </h2>
              <p className="text-meta text-ink-subtle">
                {workflow?.workflowName} · {railStages.filter((s) => s.status === 'completed').length} of {stages.length} stages done
              </p>
            </div>
            <div className="flex items-center gap-4 text-meta text-ink-subtle">
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-success-strong" />Done</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary" />Now</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-line-strong" />Next</span>
              {hasReturns && (
                <button
                  type="button"
                  onClick={() => setRouteOpen((v) => !v)}
                  aria-expanded={routeOpen}
                  className="inline-flex items-center gap-1 font-medium text-warning hover:underline underline-offset-2 cursor-pointer"
                >
                  <FiCornerUpLeft aria-hidden="true" />
                  {routeOpen ? 'Hide route taken' : 'Show route taken'}
                </button>
              )}
            </div>
          </div>
          <StageRail stages={railStages} finished={taskDone} />
          {routeOpen && (
            <div className="mt-4 pt-4 border-t border-line-subtle">
              <TaskHistoryGraph history={history} currentStageId={currentStageId} stages={stages} />
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Whose move it is. */}
          {taskDone ? (
            <div className="card flex items-start gap-3 px-5 py-4 border-l-4 border-l-success-strong">
              <FiCheckCircle aria-hidden="true" className="mt-0.5 text-success text-[20px] shrink-0" />
              <div>
                <p className="text-body font-semibold text-ink">This enquiry has been through every stage</p>
                <p className="text-meta text-ink-muted mt-0.5">Nothing is waiting on anyone. The record below is final.</p>
              </div>
            </div>
          ) : canAct ? (
            <div className="card flex items-start gap-3 px-5 py-4 border-l-4 border-l-primary bg-gradient-to-r from-primary-subtle/70 to-surface">
              <span aria-hidden="true" className="mt-0.5 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                <FiUser />
              </span>
              <div>
                <p className="text-body font-semibold text-ink">This is with you</p>
                <p className="text-meta text-ink-muted mt-0.5">
                  Fill in <span className="font-medium text-ink">{currentStage?.stageName}</span> below, then complete it
                  {nextStage ? <> to hand over to <span className="font-medium text-ink">{nextStage.stageName}</span></> : ' to close the enquiry'}.
                  {earlierStages.length > 0 && ' If something upstream is wrong, send it back instead.'}
                </p>
              </div>
            </div>
          ) : currentStage ? (
            <div className="card flex items-start gap-3 px-5 py-4 border-l-4 border-l-line-strong">
              <Avatar name={workingNow} size="md" />
              <div>
                <p className="text-body font-semibold text-ink">
                  This is with {task.assignedToMemberName || assigneeFor(currentStageId) || 'nobody yet'}
                </p>
                <p className="text-meta text-ink-muted mt-0.5">
                  It is at <span className="font-medium text-ink">{currentStage.stageName}</span>
                  {currentStage.teamName ? <> ({currentStage.teamName})</> : null}. You can read it here, but only the
                  person it is assigned to can move it on.
                </p>
              </div>
            </div>
          ) : null}

          {canAct && (
            <div id="stage-form" className="scroll-mt-6">
              {missingFields.length > 0 && (
                <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-card border border-danger-border bg-danger-subtle px-4 py-3 text-body text-danger">
                  <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold">Still needed before this can move on:</span> {missingFields.join(', ')}.
                  </span>
                </div>
              )}
              <StageForm
                schema={currentSchema}
                values={formValues}
                onChange={(values) => {
                  setFormValues(values);
                  if (missingFields.length > 0) setMissingFields(missingRequiredFields(currentSchema, values));
                }}
                readOnly={submitting}
                stages={stages}
                missing={missingFields}
              />
            </div>
          )}

          {/* The hand-over. Pinned while the form scrolls, so the way out is always in reach. */}
          {canAct && (
            <div className="sticky bottom-0 z-10 -mx-1 px-1 pb-1">
              <div className="card shadow-azure-lg px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {nextStage ? (
                      <p className="text-meta text-ink-subtle flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-ink">{currentStage?.stageName}</span>
                        <FiArrowRight aria-hidden="true" />
                        <span className="font-medium text-ink">{nextStage.stageName}</span>
                        {nextStage.teamName && <span>· {nextStage.teamName}</span>}
                      </p>
                    ) : (
                      <p className="text-meta text-ink-subtle">Last stage — completing it closes the enquiry.</p>
                    )}
                    {nextStage && autoRouting && (
                      <p className="mt-1 text-meta text-ink-muted">
                        {nextStage.stageName} {autoRouting}, so there is nobody to choose here.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {earlierStages.length > 0 && (
                      <Button
                        variant="secondary"
                        disabled={submitting}
                        onClick={() => setReturnOpen(true)}
                        icon={<FiCornerUpLeft />}
                      >
                        Send Back
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      loading={submitting}
                      disabled={nextStageBlocked}
                      onClick={() => handleComplete(currentSchema)}
                      icon={<FiCheck />}
                    >
                      {submitting ? 'Working…' : 'Complete Stage'}
                    </Button>
                  </div>
                </div>
                {nextStage && !autoRouting && (
                  <div className="mt-3 pt-3 border-t border-line-subtle max-w-md">
                    <StageAssigneePicker
                      teamId={nextStage.teamId}
                      teamName={nextStage.teamName}
                      stageName={nextStage.stageName}
                      value={nextAssignee}
                      onChange={setNextAssignee}
                      onBlockedChange={setNextStageBlocked}
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {showEnquiryRecord && (
            <Section title="Enquiry record" description="As registered by the administrator." icon={<FiFileText />}>
              <StageValues values={enquiryRecord} labels={stageFieldLabels(stages[0]?.stageName)} />
            </Section>
          )}

          {submittedStages.length > 0 && (
            <Section
              title="Submitted at earlier stages"
              description="What each stage recorded when it was completed."
              flush
            >
              <ul className="divide-y divide-line-subtle">
                {submittedStages.map((stage) => {
                  const row = stageData.find((data) => data.stageId === stage.stageId);
                  const by = completerFor(stage.stageId);
                  return (
                    <li key={stage.stageId}>
                      <details className="group" open={stage.stageId === lastSubmittedId}>
                        <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer list-none hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                          <span className="h-6 w-6 shrink-0 rounded-full bg-success-subtle text-success ring-1 ring-inset ring-success-border flex items-center justify-center text-[11px] font-semibold">
                            {stage.stageOrder}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-body font-medium text-ink truncate">{stage.stageName}</span>
                            <span className="block text-meta text-ink-subtle truncate">
                              {by ? `${by} · ` : ''}
                              {row ? formatDateToIST(row.submittedAt) : ''}
                            </span>
                          </span>
                          <FiChevronDown aria-hidden="true" className="shrink-0 text-ink-subtle transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-5 pb-5 pt-1 pl-14">
                          <StageValues values={submittedForStage(stage.stageId)} labels={stageFieldLabels(stage.stageName)} />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>

        <aside className="space-y-6 min-w-0 xl:sticky xl:top-6">
          <Section title="Details" flush>
            <dl className="divide-y divide-line-subtle text-body">
              {[
                {
                  label: 'Workflow',
                  value: workflow ? (
                    <Link to={`/workflows/${workflow.workflowId}`} className="font-medium text-primary hover:underline underline-offset-2">
                      {workflow.workflowName}
                    </Link>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Current stage', value: currentStage?.stageName || task.stageName || '—' },
                {
                  label: 'Working now',
                  value: taskDone ? (
                    <span className="text-ink-subtle">Nobody — complete</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={workingNow} size="xs" />
                      {workingNow}
                    </span>
                  ),
                },
                { label: 'Team', value: currentStage?.teamName || '—' },
                {
                  label: 'Due',
                  value: task.dueDate ? (
                    <span className={task.isOverdue ? 'text-danger font-medium' : ''}>{formatDateToIST(task.dueDate)}</span>
                  ) : (
                    'No due date'
                  ),
                },
                { label: 'Registered', value: formatDateToIST(task.createdAt) },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 px-5 py-2.5">
                  <dt className="text-ink-subtle shrink-0">{item.label}</dt>
                  <dd className="text-ink text-right min-w-0 break-words">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section
            title="Documents"
            icon={<FiPaperclip />}
            actions={
              canAct ? (
                <label
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-control border border-line-strong bg-surface text-meta font-medium text-ink shadow-azure-sm ${
                    uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-muted cursor-pointer'
                  } focus-within:shadow-focus`}
                >
                  <FiUpload aria-hidden="true" />
                  {uploading ? 'Uploading…' : 'Add file'}
                  <input type="file" className="sr-only" disabled={uploading} onChange={handleUpload} />
                </label>
              ) : undefined
            }
            flush
          >
            {attachments.length === 0 ? (
              <p className="px-5 py-4 text-body text-ink-subtle">
                No documents yet{canAct ? ' — attach the records for this stage.' : '.'}
              </p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {attachments.map((attachment) => {
                  const stage = stages.find((s) => s.stageId === attachment.stageId);
                  return (
                    <li key={attachment.attachmentId} className="px-5 py-3 flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="h-9 w-9 shrink-0 rounded-control bg-surface-sunken text-ink-muted font-mono text-[10px] font-medium flex items-center justify-center"
                      >
                        {fileExt(attachment.fileName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium text-ink truncate" title={attachment.fileName}>{attachment.fileName}</p>
                        <p className="text-meta text-ink-subtle truncate">
                          {formatBytes(attachment.sizeBytes)}
                          {stage ? ` · ${stage.stageName}` : ''} · {timeAgo(attachment.uploadedAt)}
                        </p>
                      </div>
                      <IconButton label={`Download ${attachment.fileName}`} icon={<FiDownload />} onClick={() => handleDownload(attachment)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title="Activity" description={`${history.length} event${history.length === 1 ? '' : 's'}`}>
            <ActivityTimeline history={history} />
          </Section>
        </aside>
      </div>

      <Modal
        isOpen={returnOpen}
        title="Send back"
        icon={<FiCornerUpLeft />}
        description="The enquiry returns to whoever handled that stage last, and the reason is recorded in its history."
        onClose={closeReturn}
        size="lg"
        footer={
          <>
            <Button variant="secondary" disabled={submitting} onClick={closeReturn}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} onClick={handleReturn} icon={<FiCornerUpLeft />}>
              {submitting ? 'Sending…' : 'Send Back'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field htmlFor="return-stage" label="Send back to" required error={returnError.stage}>
            <select
              id="return-stage"
              value={returnStageId}
              onChange={(e) => setReturnStageId(e.target.value)}
              className={`${inputClass} ${returnError.stage ? 'border-danger' : ''}`}
              aria-invalid={Boolean(returnError.stage)}
            >
              <option value="">Select a stage…</option>
              {earlierStages.map((stage) => (
                <option key={stage.stageId} value={stage.stageId}>
                  {stage.stageOrder}. {stage.stageName}
                  {stage.teamName ? ` (${stage.teamName})` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field
            htmlFor="return-reason"
            label="Reason"
            required
            error={returnError.reason}
            help="Whoever picks this up sees the reason on their queue, so be specific."
          >
            <textarea
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={4}
              placeholder="What needs to change before this can move forward?"
              className={`${inputClass} ${returnError.reason ? 'border-danger' : ''}`}
              aria-invalid={Boolean(returnError.reason)}
              aria-describedby={returnError.reason ? 'return-reason-error' : 'return-reason-help'}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

export default TaskDetail;
