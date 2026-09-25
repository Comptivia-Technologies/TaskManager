import { inputClass } from '../utils/formStyles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCornerUpLeft, FiInbox, FiLayers, FiPlus, FiUserX, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/taskService';
import { workflowService } from '../services/workflowService';
import { Stage, Task, Workflow } from '../types';
import { StageFormValues } from '../types/stageForms';
import LoadingSpinner from '../components/LoadingSpinner';
import Badge from '../components/Badge';
import Button from '../components/Button';
import DataTable, { Column } from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import Tabs from '../components/Tabs';
import Modal from '../components/Modal';
import Field from '../components/Field';
import Avatar from '../components/Avatar';
import SearchInput from '../components/SearchInput';
import StageProgress from '../components/flow/StageProgress';
import StageForm, { missingRequiredFields } from '../components/StageForm';
import StageAssigneePicker, { AUTO_ASSIGN } from '../components/StageAssigneePicker';
import { formatDateToIST, relativeDue } from '../utils/dateUtils';
import { PERMISSIONS, hasPermission, isOversightTeam } from '../utils/roleUtils';
import { getStageForm } from '../utils/stageFormRegistry';
import { apiErrorMessage } from '../utils/apiError';
import { humanizeStatus, isCompletedStatus, priorityRank, priorityTone, statusTone } from '../utils/status';

const REGISTER_TAB = 'register';

type QuickFilter = 'all' | 'overdue' | 'rework';

interface StagePlace {
  position: number;
  total: number;
  stageName: string;
}

const MyEnquiries = () => {
  const { user, currentMember, sessionLoading, permissions } = useAuth();
  const navigate = useNavigate();

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWorkflowId, setNewWorkflowId] = useState('');
  const [newName, setNewName] = useState('');
  const [newValues, setNewValues] = useState<StageFormValues>({});
  const [newAssignee, setNewAssignee] = useState(AUTO_ASSIGN);
  const [newAssigneeBlocked, setNewAssigneeBlocked] = useState(false);
  const [createErrors, setCreateErrors] = useState<{ workflow?: string; name?: string; missing?: string[] }>({});

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

  // Where every stage sits in its workflow, so a row can show "4 of 11" without
  // another request.
  const placeOf = useMemo(() => {
    const byWorkflow = new Map<string, Stage[]>();
    workflows.forEach((w) => byWorkflow.set(w.workflowId, [...(w.stages ?? [])].sort((a, b) => a.stageOrder - b.stageOrder)));
    return (task: Task): StagePlace | null => {
      const ordered = byWorkflow.get(task.workflowId);
      if (!ordered || ordered.length === 0) return null;
      const index = ordered.findIndex(
        (s) => s.stageId === task.stageId || (!task.stageId && task.stageName && s.stageName === task.stageName)
      );
      return { position: index + 1, total: ordered.length, stageName: ordered[index]?.stageName ?? task.stageName ?? '' };
    };
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

  // A new tab starts unfiltered; carrying "Overdue" across would hide its rows.
  useEffect(() => {
    setQuickFilter('all');
    setSearch('');
  }, [activeTab]);

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
    setCreateErrors({});
  };

  const openCreate = () => setCreateOpen(true);

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
    const missing = selectedWorkflow ? missingRequiredFields(intakeSchema, newValues) : [];
    const errors = {
      workflow: selectedWorkflow ? undefined : 'Choose which workflow this enquiry follows.',
      name: newName.trim() ? undefined : 'Give the enquiry a name.',
      missing: missing.length > 0 ? missing : undefined,
    };
    setCreateErrors(errors);
    if (errors.workflow || errors.name || errors.missing) {
      if (errors.missing) toast.error(`Fill in: ${missing.join(', ')}`);
      return;
    }

    setCreating(true);
    try {
      const created = await taskService.create({
        taskName: newName.trim(),
        taskType: selectedWorkflow!.workflowName,
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
      toast.error(apiErrorMessage(err, 'Could not register the enquiry.'));
    } finally {
      setCreating(false);
    }
  };

  if (sessionLoading) return <LoadingSpinner label="Loading your queue" />;

  if (!currentMember || (!currentMember.teamId && !canSeeRegister)) {
    const unlinked = !currentMember;
    return (
      <div>
        <PageHeader title="Enquiries" />
        <div className="card">
          <EmptyState
            icon={unlinked ? <FiUserX /> : <FiUsers />}
            title={unlinked ? "Your login isn't linked to a member" : "You're not on a team yet"}
            body={
              unlinked
                ? 'Work is assigned to members, so nothing can be shown until an administrator links your login to a member record on the Members page.'
                : 'Work reaches you through your team. Ask an administrator to add you to one on the Teams page, and your stages will appear here.'
            }
          />
        </div>
      </div>
    );
  }

  const activeStage = myStages.find((s) => s.stageId === activeTab);
  const isRegister = activeTab === REGISTER_TAB;
  const showProgress = isRegister || isIntakeTab;

  const term = search.trim().toLowerCase();
  const overdueCount = rows.filter((t) => t.isOverdue).length;
  const reworkCount = rows.filter((t) => t.needsRework).length;
  const visibleRows = rows.filter((t) => {
    if (quickFilter === 'overdue' && !t.isOverdue) return false;
    if (quickFilter === 'rework' && !t.needsRework) return false;
    if (!term) return true;
    return [t.taskName, t.stageName, t.assignedToMemberName, t.priority].some((v) => v?.toLowerCase().includes(term));
  });

  const dueCell = (t: Task) => {
    if (!t.dueDate) return <span className="text-ink-subtle">—</span>;
    const due = relativeDue(t.dueDate);
    const done = isCompletedStatus(t.status);
    return (
      <div className="text-right leading-tight">
        {!done && due && (
          <p className={`font-sans text-meta font-medium ${due.tone === 'danger' ? 'text-danger' : due.tone === 'warning' ? 'text-warning' : 'text-ink-muted'}`}>
            {due.label}
          </p>
        )}
        <p className="text-[11px] text-ink-subtle">{formatDateToIST(t.dueDate)}</p>
      </div>
    );
  };

  const columns: Column<Task>[] = [
    {
      key: 'taskName',
      header: 'Enquiry',
      sortValue: (t) => t.taskName.toLowerCase(),
      render: (t) => (
        <div className="min-w-0 max-w-[320px]">
          <span className="font-semibold text-ink block truncate" title={t.taskName}>{t.taskName}</span>
          {t.needsRework ? (
            <span className="mt-0.5 flex items-start gap-1.5 text-meta text-warning">
              <FiCornerUpLeft className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-2">
                <strong className="font-semibold">Sent back.</strong>
                {t.reworkReason ? ` ${t.reworkReason}` : ' Needs rework.'}
              </span>
            </span>
          ) : (
            <span className="block text-meta text-ink-subtle truncate">
              {workflows.find((w) => w.workflowId === t.workflowId)?.workflowName ?? ''}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'progress',
      header: showProgress ? 'Progress' : 'Stage',
      hideOnMobile: true,
      sortValue: (t) => placeOf(t)?.position ?? 0,
      render: (t) => {
        const place = placeOf(t);
        if (!place) return <span className="text-ink-muted">{t.stageName ?? '—'}</span>;
        return (
          <StageProgress
            total={place.total}
            current={place.position}
            done={isCompletedStatus(t.status)}
            rework={t.needsRework}
            stageName={place.stageName || t.stageName}
          />
        );
      },
    },
    ...(!isIntakeTab
      ? [{
          key: 'assignee',
          header: 'With',
          hideOnMobile: true,
          sortValue: (t: Task) => t.assignedToMemberName ?? '',
          render: (t: Task) =>
            t.assignedToMemberName ? (
              <span className="inline-flex items-center gap-2 text-ink">
                <Avatar name={t.assignedToMemberName} size="sm" />
                <span className="truncate max-w-[160px]">{t.assignedToMemberName}</span>
              </span>
            ) : (
              <span className="text-ink-subtle">Unassigned</span>
            ),
        } as Column<Task>]
      : []),
    {
      key: 'priority',
      header: 'Priority',
      sortValue: (t) => priorityRank(t.priority),
      render: (t) => <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (t) => (t.isOverdue ? 'zz-overdue' : t.status),
      render: (t) => (
        <Badge dot tone={statusTone(t.status, t.isOverdue)} icon={t.isOverdue ? <FiAlertCircle /> : undefined}>
          {t.isOverdue ? 'Overdue' : humanizeStatus(t.status)}
        </Badge>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due',
      align: 'right',
      hideOnMobile: true,
      sortValue: (t) => t.dueDate ?? '',
      render: dueCell,
    },
  ];

  const mobileCard = (t: Task) => {
    const place = placeOf(t);
    const due = relativeDue(t.dueDate);
    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <span className="font-semibold text-ink leading-5">{t.taskName}</span>
          <Badge dot tone={statusTone(t.status, t.isOverdue)}>{t.isOverdue ? 'Overdue' : humanizeStatus(t.status)}</Badge>
        </div>
        {place && (
          <StageProgress total={place.total} current={place.position} done={isCompletedStatus(t.status)} rework={t.needsRework} stageName={place.stageName} />
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-subtle">
          <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
          {t.assignedToMemberName && !isIntakeTab && <span>With {t.assignedToMemberName}</span>}
          {due && !isCompletedStatus(t.status) && <span className={due.tone === 'danger' ? 'text-danger font-medium' : ''}>{due.label}</span>}
        </div>
        {t.needsRework && (
          <p className="text-meta text-warning flex items-start gap-1.5">
            <FiCornerUpLeft aria-hidden="true" className="mt-0.5 shrink-0" />
            {t.reworkReason || 'Sent back — needs rework.'}
          </p>
        )}
      </div>
    );
  };

  const filterChip = (id: QuickFilter, label: string, count: number, tone?: 'danger' | 'warning') => {
    const active = quickFilter === id;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setQuickFilter(active && id !== 'all' ? 'all' : id)}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-meta font-medium cursor-pointer ring-1 ring-inset ${
          active
            ? 'bg-ink text-white ring-ink'
            : 'bg-surface text-ink-muted ring-line-strong hover:text-ink hover:ring-[#A9B0C4]'
        }`}
      >
        {tone && !active && (
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone === 'danger' ? 'bg-danger' : 'bg-warning-strong'}`} />
        )}
        {label}
        <span className={`tabular ${active ? 'text-white/70' : 'text-ink-subtle'}`}>{count}</span>
      </button>
    );
  };

  const tabs = [
    ...myStages.map((stage) => ({
      id: stage.stageId,
      label: stage.stageName,
      count: firstStageIds.has(stage.stageId) ? undefined : counts[stage.stageId] ?? undefined,
    })),
    ...(canSeeRegister ? [{ id: REGISTER_TAB, label: 'All enquiries', icon: <FiLayers /> }] : []),
  ];

  const subtitle = isRegister
    ? 'Every enquiry in the organisation, wherever it is in its workflow.'
    : isIntakeTab
      ? 'Enquiries you registered, and how far each has got.'
      : activeStage
        ? `Work waiting on you at ${activeStage.stageName}.`
        : undefined;

  return (
    <div>
      <PageHeader
        title="Enquiries"
        subtitle={subtitle}
        meta={
          <span className="inline-flex items-center gap-2">
            <Avatar name={`${currentMember.firstName} ${currentMember.lastName}`} size="xs" />
            {currentMember.firstName} {currentMember.lastName}
            {currentMember.teamName ? ` · ${currentMember.teamName}` : ''}
          </span>
        }
        actions={
          canRegister && isIntakeTab ? (
            <Button variant="primary" icon={<FiPlus />} onClick={openCreate}>
              New Enquiry
            </Button>
          ) : null
        }
      />

      {tabs.length > 0 && (
        <div className="mb-5">
          <Tabs label="Enquiry queues" tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
        </div>
      )}

      {error && (
        <div role="alert" className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-danger-subtle border border-danger-border rounded-card text-danger text-body">
          <FiAlertCircle aria-hidden="true" className="shrink-0" />
          {error}
        </div>
      )}

      <DataTable<Task>
        caption={activeStage ? `Enquiries at ${activeStage.stageName}` : 'Enquiries'}
        columns={columns}
        rows={visibleRows}
        rowKey={(t) => t.taskId}
        loading={loading}
        onRowClick={(t) => navigate(`/tasks/${t.taskId}`)}
        rowTone={(t) => (t.isOverdue ? 'danger' : t.needsRework ? 'warning' : undefined)}
        mobileCard={mobileCard}
        toolbar={
          rows.length > 0 || term ? (
            <>
              <SearchInput
                label="Search enquiries"
                placeholder="Search by name, stage or person"
                value={search}
                onChange={setSearch}
                className="w-full sm:w-72"
              />
              <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                {filterChip('all', 'All', rows.length)}
                {filterChip('overdue', 'Overdue', overdueCount, 'danger')}
                {filterChip('rework', 'Sent back', reworkCount, 'warning')}
              </div>
            </>
          ) : undefined
        }
        empty={
          rows.length > 0 ? (
            <EmptyState
              compact
              icon={<FiInbox />}
              title="Nothing matches"
              body="No enquiry in this queue matches the search or filter."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setQuickFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<FiInbox />}
              title={isIntakeTab ? 'No enquiries registered yet' : isRegister ? 'No enquiries yet' : 'Nothing waiting for you here'}
              body={
                isIntakeTab
                  ? 'Register one and it will appear here as it moves through the workflow.'
                  : isRegister
                    ? 'Enquiries appear here as soon as the administrator registers them.'
                    : `Enquiries appear once one reaches ${activeStage?.stageName ?? 'this stage'} and is assigned to you.`
              }
              action={
                canRegister && isIntakeTab ? (
                  <Button variant="primary" icon={<FiPlus />} onClick={openCreate}>
                    New Enquiry
                  </Button>
                ) : null
              }
            />
          )
        }
      />

      <Modal
        isOpen={createOpen}
        title="Register a new enquiry"
        description="It starts at the first stage of the workflow and moves on from there."
        icon={<FiPlus />}
        size="xl"
        onClose={creating ? () => {} : closeCreate}
        footer={
          <>
            <Button variant="secondary" disabled={creating} onClick={closeCreate}>
              Cancel
            </Button>
            <Button variant="secondary" disabled={creating} onClick={() => handleCreate(false)}>
              {creating ? 'Working…' : 'Save enquiry'}
            </Button>
            <Button
              variant="primary"
              loading={creating}
              disabled={newAssigneeBlocked || !secondStage}
              onClick={() => handleCreate(true)}
            >
              {creating ? 'Working…' : 'Save & assign'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field htmlFor="new-workflow" label="Workflow" required error={createErrors.workflow}>
              <select
                id="new-workflow"
                value={newWorkflowId}
                onChange={(e) => {
                  setNewWorkflowId(e.target.value);
                  setNewValues({});
                }}
                aria-invalid={Boolean(createErrors.workflow)}
                className={`${inputClass} ${createErrors.workflow ? 'border-danger' : ''}`}
              >
                <option value="">Select a workflow…</option>
                {workflows.map((w) => (
                  <option key={w.workflowId} value={w.workflowId}>{w.workflowName}</option>
                ))}
              </select>
            </Field>
            <Field htmlFor="new-name" label="Enquiry name" required error={createErrors.name} help="Usually the enquiry number and the project.">
              <input
                id="new-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ENQ-0142 · Al Noor Tower"
                aria-invalid={Boolean(createErrors.name)}
                className={`${inputClass} ${createErrors.name ? 'border-danger' : ''}`}
              />
            </Field>
          </div>

          {selectedWorkflow && orderedNewStages.length > 0 && (
            <div className="rounded-card bg-surface-muted border border-line px-4 py-3">
              <p className="eyebrow mb-2">Route</p>
              <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-meta">
                {orderedNewStages.map((stage, index) => (
                  <li key={stage.stageId} className="inline-flex items-center gap-1.5">
                    <span className={index === 0 ? 'font-semibold text-primary' : 'text-ink-muted'}>{stage.stageName}</span>
                    {index < orderedNewStages.length - 1 && <span aria-hidden="true" className="text-ink-subtle">→</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {selectedWorkflow && (
            <div>
              <p className="eyebrow mb-3">{intakeSchema.title}</p>
              <StageForm
                bare
                schema={intakeSchema}
                values={newValues}
                onChange={(values) => {
                  setNewValues(values);
                  if (createErrors.missing) setCreateErrors((e) => ({ ...e, missing: missingRequiredFields(intakeSchema, values) }));
                }}
                readOnly={creating}
                stages={orderedNewStages}
                missing={createErrors.missing}
              />
            </div>
          )}

          {selectedWorkflow && secondStage && (
            <div className="pt-5 border-t border-line-subtle max-w-md">
              <StageAssigneePicker
                teamId={secondStage.teamId}
                teamName={secondStage.teamName}
                stageName={secondStage.stageName}
                value={newAssignee}
                onChange={setNewAssignee}
                onBlockedChange={setNewAssigneeBlocked}
                disabled={creating}
              />
              <p className="mt-1.5 text-meta text-ink-subtle">Used by “Save &amp; assign”, which registers it and hands it straight on.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MyEnquiries;
