import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCornerUpLeft, FiInbox, FiPlus, FiUserCheck, FiUserX, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/taskService';
import { workflowService } from '../services/workflowService';
import { Stage, Task, Workflow } from '../types';
import { StageFormValues } from '../types/stageForms';
import LoadingSpinner from '../components/LoadingSpinner';
import StageForm, { missingRequiredFields } from '../components/StageForm';
import StageAssigneePicker, { AUTO_ASSIGN } from '../components/StageAssigneePicker';
import { formatDateToIST } from '../utils/dateUtils';
import { PERMISSIONS, hasPermission, isOversightTeam } from '../utils/roleUtils';
import { getStageForm } from '../utils/stageFormRegistry';

const REGISTER_TAB = 'register';

const isCompleted = (status: string) => {
  const s = status.toLowerCase();
  return s.includes('completed') || s.includes('done');
};

const statusColor = (status: string, isOverdue?: boolean) => {
  if (isOverdue) return 'bg-red-100 text-red-800 border-red-200';
  const s = status.toLowerCase();
  if (isCompleted(s)) return 'bg-green-100 text-green-800 border-green-200';
  if (s.includes('progress') || s.includes('active')) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (s.includes('assigned') || s.includes('pending')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
};

const priorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const tabClass = (active: boolean) =>
  `px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
    active ? 'border-[#434E78] text-[#434E78]' : 'border-transparent text-black/60 hover:text-black'
  }`;

const MyEnquiries = () => {
  const { user, currentMember, sessionLoading, permissions } = useAuth();
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWorkflowId, setNewWorkflowId] = useState('');
  const [newName, setNewName] = useState('');
  const [newValues, setNewValues] = useState<StageFormValues>({});
  const [newAssignee, setNewAssignee] = useState(AUTO_ASSIGN);
  const [newAssigneeBlocked, setNewAssigneeBlocked] = useState(false);

  // Only the oversight teams follow every enquiry. Everyone else sees the work
  // assigned to them, whatever their role happens to permit elsewhere.
  const canSeeRegister = isOversightTeam(currentMember?.teamName);
  const canRegister = hasPermission(permissions, PERMISSIONS.tasksManage);

  // One tab per stage this member's team owns. Derived from the workflows call,
  // which already carries every stage with its team, so no extra endpoint is needed.
  const myStages = useMemo<Stage[]>(() => {
    if (!currentMember?.teamId) return [];
    return workflows
      .flatMap((w) => w.stages ?? [])
      .filter((s) => s.teamId === currentMember.teamId)
      .sort((a, b) => a.stageOrder - b.stageOrder);
  }, [workflows, currentMember]);

  const firstStageIds = useMemo(() => {
    const ids = new Set<string>();
    workflows.forEach((w) => {
      const ordered = [...(w.stages ?? [])].sort((a, b) => a.stageOrder - b.stageOrder);
      if (ordered[0]) ids.add(ordered[0].stageId);
    });
    return ids;
  }, [workflows]);

  const isIntakeTab = Boolean(activeTab && firstStageIds.has(activeTab));

  useEffect(() => {
    workflowService
      .getAll()
      .then((data) => setWorkflows(data ?? []))
      .catch(() => setError('Could not load the workflows.'));
  }, []);

  useEffect(() => {
    if (activeTab) return;
    if (myStages.length > 0) setActiveTab(myStages[0].stageId);
    else if (canSeeRegister) setActiveTab(REGISTER_TAB);
  }, [myStages, activeTab, canSeeRegister]);

  const loadTab = useCallback(async () => {
    if (!user || !currentMember || !activeTab) return;
    try {
      setLoading(true);
      setError(null);

      if (activeTab === REGISTER_TAB) {
        const paged = await taskService.getAllPaginated(undefined, 1, 200);
        setRows(paged.data ?? []);
        return;
      }

      if (firstStageIds.has(activeTab)) {
        // The intake tab is a record of what this person raised, at whatever stage it
        // has since reached, rather than a queue of work waiting on them.
        const all = (await taskService.getAllPaginated(undefined, 1, 200)).data ?? [];
        setRows(all.filter((t) => t.createdByMemberId === currentMember.memberId));
        return;
      }

      const atStage = await taskService.getByStage(activeTab);
      setRows(atStage.filter((t) => t.assignedToMemberId === currentMember.memberId));
    } catch (err) {
      setError('Could not load these enquiries.');
      console.error('Error loading enquiries:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentMember, activeTab, firstStageIds]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentMember) {
      setLoading(false);
      return;
    }
    loadTab();
  }, [loadTab, currentMember, sessionLoading]);

  // Counts for the queue tabs, so work waiting elsewhere is visible without
  // clicking through every tab.
  useEffect(() => {
    if (!currentMember || myStages.length === 0) return;
    let cancelled = false;
    Promise.all(
      myStages
        .filter((s) => !firstStageIds.has(s.stageId))
        .map(async (s) => {
          const tasks = await taskService.getByStage(s.stageId).catch(() => [] as Task[]);
          return [s.stageId, tasks.filter((t) => t.assignedToMemberId === currentMember.memberId).length] as const;
        })
    ).then((pairs) => {
      if (!cancelled) setCounts(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [myStages, currentMember, firstStageIds, rows]);

  const selectedWorkflow = workflows.find((w) => w.workflowId === newWorkflowId);
  const orderedNewStages = [...(selectedWorkflow?.stages ?? [])].sort((a, b) => a.stageOrder - b.stageOrder);
  const intakeSchema = getStageForm(orderedNewStages[0]?.stageName);
  const secondStage = orderedNewStages[1];

  const closeCreate = () => {
    setCreateOpen(false);
    setNewWorkflowId('');
    setNewName('');
    setNewValues({});
    setNewAssignee(AUTO_ASSIGN);
  };

  const waitForFirstStage = async (taskId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        const fresh = await taskService.getById(taskId);
        if (fresh.stageId) return fresh;
      } catch {
        // still in flight
      }
    }
    return null;
  };

  const handleCreate = async (assignAfter = false) => {
    if (!selectedWorkflow) {
      toast.error('Choose which workflow this enquiry follows.');
      return;
    }
    if (!newName.trim()) {
      toast.error('Give the enquiry a name.');
      return;
    }
    const missing = missingRequiredFields(intakeSchema, newValues);
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.join(', ')}`);
      return;
    }

    setCreating(true);
    try {
      const created = await taskService.create({
        taskName: newName.trim(),
        taskType: selectedWorkflow.workflowName,
        taskData: newValues,
        // Sending the creator is what puts the first stage with them rather than
        // with whichever teammate happens to be least loaded.
        createdByMemberId: currentMember?.memberId,
      });

      if (assignAfter) {
        const landed = await waitForFirstStage(created.taskId);
        if (landed) {
          await taskService.completeStage(created.taskId, undefined, newAssignee || undefined);
          toast.success('Enquiry registered and moved to the next stage.');
        } else {
          toast.warning('Enquiry registered, but it has not reached the first stage yet.');
        }
      } else {
        toast.success('Enquiry registered.');
      }

      closeCreate();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await loadTab();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not register the enquiry.');
    } finally {
      setCreating(false);
    }
  };

  if (sessionLoading) return <LoadingSpinner />;

  if (!currentMember) {
    return (
      <div className="p-8 lg:p-10 bg-white min-h-screen font-sans">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-semibold text-black mb-2 tracking-tight">Enquiry</h1>
          <div className="mt-8 bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 p-8 text-center">
            <FiUserX className="text-4xl text-[#434E78] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-black mb-2">Your login isn't linked to a member</h2>
            <p className="text-black/70 text-sm">
              Work is assigned to members, so nothing can be shown until an administrator links
              your login to a member record on the Members page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentMember.teamId && !canSeeRegister) {
    return (
      <div className="p-8 lg:p-10 bg-white min-h-screen font-sans">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-semibold text-black mb-2 tracking-tight">Enquiry</h1>
          <div className="mt-8 bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 p-8 text-center">
            <FiUsers className="text-4xl text-[#434E78] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-black mb-2">You're not on a team yet</h2>
            <p className="text-black/70 text-sm">
              Work reaches you through your team. Ask an administrator to add you to one on the
              Teams page, and your stages will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeStage = myStages.find((s) => s.stageId === activeTab);
  const showStage = activeTab === REGISTER_TAB || !isIntakeTab;

  return (
    <div className="p-8 lg:p-10 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-black mb-2 tracking-tight">Enquiry</h1>
            <p className="text-black/70 text-base">
              {currentMember.firstName} {currentMember.lastName}
              {currentMember.teamName ? ` · ${currentMember.teamName}` : ''}
            </p>
          </div>
          {canRegister && isIntakeTab && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center px-4 py-2 rounded-azure-sm bg-[#434E78] text-white text-sm font-medium hover:bg-[#434E78]/90"
            >
              <FiPlus className="mr-2" />
              New Enquiry
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[#434E78]/20 mb-6">
          {myStages.map((stage) => (
            <button
              key={stage.stageId}
              type="button"
              onClick={() => setActiveTab(stage.stageId)}
              className={tabClass(activeTab === stage.stageId)}
            >
              {stage.stageName}
              {counts[stage.stageId] > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#434E78] text-white text-xs">
                  {counts[stage.stageId]}
                </span>
              )}
            </button>
          ))}
          {canSeeRegister && (
            <button
              type="button"
              onClick={() => setActiveTab(REGISTER_TAB)}
              className={tabClass(activeTab === REGISTER_TAB)}
            >
              All enquiries
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-azure-sm text-red-800">{error}</div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 p-12 text-center">
            <FiInbox className="text-4xl text-[#434E78] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-black mb-2">
              {isIntakeTab ? 'You have not registered any enquiries yet' : 'Nothing waiting for you here'}
            </h2>
            <p className="text-black/70 text-sm">
              {isIntakeTab
                ? 'Register one and it will appear here as it moves through the workflow.'
                : `Enquiries appear once one reaches ${activeStage?.stageName ?? 'this stage'} and is assigned to you.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((enquiry) => (
              <button
                key={enquiry.taskId}
                type="button"
                onClick={() => navigate(`/tasks/${enquiry.taskId}`)}
                className={`w-full text-left bg-white rounded-azure-sm shadow-azure-sm border p-5 hover:shadow-azure-lg transition-all duration-150 ${
                  enquiry.needsRework ? 'border-orange-300' : 'border-[#434E78]/20 hover:border-[#434E78]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-black truncate">{enquiry.taskName}</h3>
                    {enquiry.needsRework && (
                      <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded-azure-sm px-2 py-1">
                        <FiCornerUpLeft className="mt-0.5 shrink-0" />
                        <span>
                          <strong>Sent back — needs rework.</strong>
                          {enquiry.reworkReason ? ` ${enquiry.reworkReason}` : ''}
                        </span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-black/60">
                      {showStage && enquiry.stageName && (
                        <span className="font-medium text-[#434E78]">{enquiry.stageName}</span>
                      )}
                      {enquiry.assignedToMemberName && !isIntakeTab && (
                        <span className="inline-flex items-center gap-1">
                          <FiUserCheck className="text-[#434E78]" />
                          {enquiry.assignedToMemberName}
                        </span>
                      )}
                      {enquiry.dueDate && <span>{formatDateToIST(enquiry.dueDate)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor(enquiry.status, enquiry.isOverdue)}`}>
                      {enquiry.isOverdue ? 'Overdue' : enquiry.status}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${priorityColor(enquiry.priority)}`}>
                      {enquiry.priority}
                    </span>
                    {enquiry.isOverdue && <FiAlertCircle className="text-red-500" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-azure-sm shadow-azure-lg w-full max-w-3xl my-8">
            <div className="px-6 py-4 border-b border-[#434E78]/10">
              <h2 className="text-lg font-semibold text-black">Register a new enquiry</h2>
            </div>

            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-workflow" className="block text-black text-sm font-semibold mb-2">
                  Workflow <span className="text-red-600">*</span>
                </label>
                <select
                  id="new-workflow"
                  value={newWorkflowId}
                  onChange={(e) => {
                    setNewWorkflowId(e.target.value);
                    setNewValues({});
                  }}
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] bg-white text-sm"
                >
                  <option value="">Select a workflow...</option>
                  {workflows.map((w) => (
                    <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-name" className="block text-black text-sm font-semibold mb-2">
                  Enquiry name <span className="text-red-600">*</span>
                </label>
                <input
                  id="new-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ENQ-0142 · Al Noor Tower"
                  className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] bg-white text-sm"
                />
              </div>
            </div>

            {selectedWorkflow && (
              <div className="px-6">
                <StageForm
                  schema={intakeSchema}
                  values={newValues}
                  onChange={setNewValues}
                  readOnly={creating}
                  stages={orderedNewStages}
                />
              </div>
            )}

            {selectedWorkflow && secondStage && (
              <div className="px-6 pb-2 max-w-md">
                <StageAssigneePicker
                  teamId={secondStage.teamId}
                  teamName={secondStage.teamName}
                  stageName={secondStage.stageName}
                  value={newAssignee}
                  onChange={setNewAssignee}
                  onBlockedChange={setNewAssigneeBlocked}
                  disabled={creating}
                />
                <p className="text-xs text-black/60 mt-1">Only used by "Save &amp; assign".</p>
              </div>
            )}

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#434E78]/10">
              <button
                type="button"
                disabled={creating}
                onClick={closeCreate}
                className="px-4 py-2 rounded-azure-sm border border-[#434E78]/30 text-[#434E78] text-sm font-medium hover:bg-[#434E78]/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => handleCreate(false)}
                className="px-4 py-2 rounded-azure-sm border border-[#434E78]/30 text-[#434E78] text-sm font-medium hover:bg-[#434E78]/5 disabled:opacity-50"
              >
                {creating ? 'Working...' : 'Save enquiry'}
              </button>
              <button
                type="button"
                disabled={creating || newAssigneeBlocked || !secondStage}
                onClick={() => handleCreate(true)}
                className="px-4 py-2 rounded-azure-sm bg-[#434E78] text-white text-sm font-medium hover:bg-[#434E78]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Working...' : 'Save & assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyEnquiries;
