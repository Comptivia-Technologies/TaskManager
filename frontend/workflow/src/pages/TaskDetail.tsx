import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiCornerUpLeft, FiDownload, FiPaperclip, FiUpload, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import StageForm, { extractNominations, missingRequiredFields } from '../components/StageForm';
import StageAssigneePicker, { AUTO_ASSIGN } from '../components/StageAssigneePicker';
import TaskHistoryGraph, { resolveCurrentStageId } from '../components/TaskHistoryGraph';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/taskService';
import { workflowService } from '../services/workflowService';
import { Stage, Task, TaskAttachment, TaskStageData, TaskStageHistory, Workflow } from '../types';
import { StageFormValues } from '../types/stageForms';
import { formatDateToIST } from '../utils/dateUtils';
import { PERMISSIONS, hasPermission } from '../utils/roleUtils';
import { getStageForm } from '../utils/stageFormRegistry';

const apiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const parseJson = (raw?: string): Record<string, any> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const statusBadge = (status: string) => {
  if (status === 'Completed') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'Current') return 'bg-[#434E78]/10 text-[#434E78] border-[#434E78]/30';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

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
  const [stageData, setStageData] = useState<TaskStageData[]>([]);
  const [formValues, setFormValues] = useState<StageFormValues>({});
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [nextAssignee, setNextAssignee] = useState(AUTO_ASSIGN);
  const [nextStageBlocked, setNextStageBlocked] = useState(false);

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
      taskData.stageId && taskData.stageId === firstStageId ? parseJson(taskData.dataJson) : {};

    setFormValues(
      alreadySubmitted
        ? (parseJson(alreadySubmitted.dataJson) as StageFormValues)
        : (intakeValues as StageFormValues)
    );
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
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.join(', ')}`);
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

  const handleReturn = async () => {
    if (!returnStageId) {
      toast.error('Select the stage to send this back to.');
      return;
    }
    if (!returnReason.trim()) {
      toast.error('A reason is required when sending work back.');
      return;
    }
    await runAction(
      () => taskService.returnStage(id!, returnStageId, returnReason.trim()),
      'Sent back to the earlier stage.',
      'Could not send this back.'
    );
    setReturnOpen(false);
    setReturnStageId('');
    setReturnReason('');
  };

  if (loading) return <LoadingSpinner />;

  if (!task) {
    return (
      <div className="p-8">
        <p className="text-center text-black/60 font-sans">Task not found</p>
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
  const canSeeProgression = hasPermission(permissions, PERMISSIONS.workflowsView);

  const currentSchema = getStageForm(currentStage?.stageName);
  const isFirstStage = Boolean(currentStage && stages[0] && currentStage.stageId === stages[0].stageId);
  const enquiryRecord = parseJson(task.dataJson);
  const submittedForStage = (stageId: string) => parseJson(stageData.find((row) => row.stageId === stageId)?.dataJson);

  const stageStatus = (stage: Stage) => {
    const isCurrent = stage.stageId === currentStageId;
    if (isCurrent && !taskDone) return 'Current';
    if ((currentStage && stage.stageOrder < currentStage.stageOrder) || (taskDone && isCurrent)) return 'Completed';
    return 'Upcoming';
  };

  return (
    <div className="p-8 lg:p-10 bg-white min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/enquiry')}
          className="mb-4 flex items-center text-[#434E78] hover:text-[#434E78]/80 font-medium text-sm"
        >
          <FiArrowLeft className="mr-2" />
          Back to Enquiry
        </button>

        <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 p-6 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-black tracking-tight">{task.taskName}</h1>
              {task.description && <p className="mt-2 text-sm text-black/70">{task.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-azure-sm text-xs font-medium border bg-blue-100 text-blue-800 border-blue-200">
                {task.status}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-azure-sm text-xs font-medium border bg-yellow-100 text-yellow-800 border-yellow-200">
                {task.priority}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 text-sm">
            <div>
              <p className="text-xs text-black/60">Workflow</p>
              {workflow ? (
                <button
                  type="button"
                  onClick={() => navigate(`/workflows/${workflow.workflowId}`)}
                  className="font-semibold text-[#434E78] hover:underline"
                >
                  {workflow.workflowName}
                </button>
              ) : (
                <p className="font-semibold text-black">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-black/60">Current stage</p>
              <p className="font-semibold text-black">{currentStage?.stageName || task.stageName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-black/60">Working now</p>
              <p className="font-semibold text-black inline-flex items-center">
                <FiUser className="mr-1.5 text-[#434E78]/60" />
                {workingNow}
              </p>
            </div>
            <div>
              <p className="text-xs text-black/60">Due</p>
              <p className="font-semibold text-black">{task.dueDate ? formatDateToIST(task.dueDate) : 'No due date'}</p>
            </div>
          </div>
        </div>

        {!canAct && !taskDone && currentStage && (
          <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 p-5 mb-4">
            <p className="text-sm font-semibold text-black">
              This is with {task.assignedToMemberName || assigneeFor(currentStageId) || 'nobody yet'}
            </p>
            <p className="text-xs text-black/60 mt-0.5">
              It is at <span className="font-medium">{currentStage.stageName}</span>
              {currentStage.teamName ? <> ({currentStage.teamName})</> : null}. You can read it here, but only
              the person it is assigned to can move it on.
            </p>
          </div>
        )}

        {canAct && (
          <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 p-5 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-black">This is with you</p>
                <p className="text-xs text-black/60 mt-0.5">
                  Complete <span className="font-medium">{currentStage?.stageName}</span> to move it on, or send it
                  back to an earlier stage.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {earlierStages.length > 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setReturnOpen(true)}
                    className="inline-flex items-center px-4 py-2 rounded-azure-sm border border-[#434E78]/30 text-[#434E78] text-sm font-medium hover:bg-[#434E78]/5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiCornerUpLeft className="mr-2" />
                    Send Back
                  </button>
                )}
                <button
                  type="button"
                  disabled={submitting || nextStageBlocked}
                  onClick={() => handleComplete(currentSchema)}
                  className="inline-flex items-center px-4 py-2 rounded-azure-sm bg-[#434E78] text-white text-sm font-medium hover:bg-[#434E78]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiCheck className="mr-2" />
                  {submitting ? 'Working...' : 'Complete Stage'}
                </button>
              </div>
            </div>

            {nextStage && (
              <div className="mt-4 pt-4 border-t border-[#434E78]/10 max-w-md">
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
        )}

        {Object.keys(enquiryRecord).length > 0 && !isFirstStage && (
          <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 p-6 mb-4">
            <h2 className="text-lg font-semibold text-black mb-4">Enquiry record</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {Object.entries(enquiryRecord).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-black/60">{key}</dt>
                  <dd className="font-medium text-black break-words">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {canAct && (
          <StageForm
            schema={currentSchema}
            values={formValues}
            onChange={setFormValues}
            readOnly={submitting}
            stages={stages}
          />
        )}

        <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-[#434E78]/10 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-black inline-flex items-center">
              <FiPaperclip className="mr-2 text-[#434E78]" />
              Documents
            </h2>
            {canAct && (
              <label className={`inline-flex items-center px-4 py-2 rounded-azure-sm border border-[#434E78]/30 text-[#434E78] text-sm font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#434E78]/5 cursor-pointer'}`}>
                <FiUpload className="mr-2" />
                {uploading ? 'Uploading...' : 'Add file'}
                <input type="file" className="hidden" disabled={uploading} onChange={handleUpload} />
              </label>
            )}
          </div>
          {attachments.length === 0 ? (
            <p className="px-6 py-6 text-sm text-black/60">
              No documents yet{canAct ? ' — attach the records for this stage.' : '.'}
            </p>
          ) : (
            <ul className="divide-y divide-[#434E78]/10">
              {attachments.map((attachment) => {
                const stage = stages.find((s) => s.stageId === attachment.stageId);
                return (
                  <li key={attachment.attachmentId} className="px-6 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black truncate">{attachment.fileName}</p>
                      <p className="text-xs text-black/60">
                        {formatBytes(attachment.sizeBytes)}
                        {stage ? ` · ${stage.stageName}` : ''} · {formatDateToIST(attachment.uploadedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(attachment)}
                      className="inline-flex items-center px-3 py-1.5 rounded-azure-sm border border-[#434E78]/30 text-[#434E78] text-xs font-medium hover:bg-[#434E78]/5 shrink-0"
                    >
                      <FiDownload className="mr-1.5" />
                      Download
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {stageData.length > 0 && (
          <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-[#434E78]/10">
              <h2 className="text-lg font-semibold text-black">Submitted at earlier stages</h2>
            </div>
            <div className="px-6 py-5 space-y-5">
              {stages
                .filter((stage) => stageData.some((row) => row.stageId === stage.stageId))
                .map((stage) => {
                  const submitted = submittedForStage(stage.stageId);
                  return (
                    <div key={stage.stageId}>
                      <p className="text-sm font-semibold text-[#434E78] mb-2">
                        {stage.stageOrder}. {stage.stageName}
                      </p>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                        {Object.entries(submitted).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-xs text-black/60">{key}</dt>
                            <dd className="text-black break-words">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {canSeeProgression && <TaskHistoryGraph history={history} currentStageId={currentStageId} stages={stages} />}

        {canSeeProgression && (
        <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden mb-4">
          <div className="px-6 py-4 border-b border-[#434E78]/10">
            <h2 className="text-lg font-semibold text-black">Stages</h2>
          </div>
          {stages.length === 0 ? (
            <p className="px-6 py-6 text-sm text-black/60">No stages on this workflow.</p>
          ) : (
            <table className="min-w-full">
              <thead className="bg-[#434E78]/5">
                <tr>
                  {['Stage', 'Status', 'Team', 'Person'].map((heading) => (
                    <th key={heading} className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#434E78]/10">
                {stages.map((stage) => {
                  const status = stageStatus(stage);
                  const completer = completerFor(stage.stageId);
                  const person = status === 'Current'
                    ? task.assignedToMemberName || assigneeFor(stage.stageId) || 'Unassigned'
                    : completer || '—';
                  return (
                    <tr key={stage.stageId}>
                      <td className="px-6 py-3 text-sm font-semibold text-black">
                        {stage.stageOrder}. {stage.stageName}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-azure-sm text-xs font-medium border ${statusBadge(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-black">{stage.teamName || '—'}</td>
                      <td className="px-6 py-3 text-sm text-black">
                        {person}
                        {status === 'Upcoming' && completer ? <span className="block text-xs text-black/50">Last completed</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        )}

        <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#434E78]/10">
            <h2 className="text-lg font-semibold text-black">Activity</h2>
          </div>
          {history.length === 0 ? (
            <p className="px-6 py-6 text-sm text-black/60">No history yet.</p>
          ) : (
            <ol className="px-6 py-4 space-y-3">
              {[...history].sort((a, b) => a.sequence - b.sequence).map((entry) => (
                <li key={entry.historyId} className="border border-[#434E78]/15 rounded-azure-sm px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-[#434E78]">{entry.action}</span>
                    <span className="text-xs text-black/60">{formatDateToIST(entry.occurredAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-black">
                    {entry.memberName} · {entry.stageName}
                  </p>
                  {(entry.fromStageName || entry.toStageName) && (
                    <p className="mt-1 text-xs text-black/70">
                      {entry.fromStageName || '—'} → {entry.toStageName || '—'}
                    </p>
                  )}
                  {entry.reason && <p className="mt-1 text-xs text-black/70">{entry.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {returnOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-azure-sm shadow-azure-lg w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-black mb-1">Send back</h2>
            <p className="text-sm text-black/60 mb-4">
              The enquiry returns to whoever handled that stage last, and the reason is recorded in its history.
            </p>

            <label className="block text-black text-sm font-semibold mb-2">Send back to</label>
            <select
              value={returnStageId}
              onChange={(e) => setReturnStageId(e.target.value)}
              className="w-full px-3 py-2 mb-4 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] bg-white text-sm"
            >
              <option value="">Select a stage...</option>
              {earlierStages.map((stage) => (
                <option key={stage.stageId} value={stage.stageId}>
                  {stage.stageOrder}. {stage.stageName}
                  {stage.teamName ? ` (${stage.teamName})` : ''}
                </option>
              ))}
            </select>

            <label className="block text-black text-sm font-semibold mb-2">
              Reason <span className="text-xs text-black/60 font-normal">(required)</span>
            </label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={4}
              placeholder="What needs to change before this can move forward?"
              className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] bg-white text-sm"
            />

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReturnOpen(false)}
                className="px-4 py-2 rounded-azure-sm border border-[#434E78]/30 text-[#434E78] text-sm font-medium hover:bg-[#434E78]/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleReturn}
                className="px-4 py-2 rounded-azure-sm bg-[#434E78] text-white text-sm font-medium hover:bg-[#434E78]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending...' : 'Send Back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDetail;
