import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Badge, { BadgeTone } from '../components/Badge';
import Avatar from '../components/Avatar';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import SkillMeter from '../components/SkillMeter';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMembers } from '../hooks/useMembers';
import { workloadService } from '../services/workloadService';
import { Member, WorkloadResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiActivity, FiAlertCircle, FiCheckCircle, FiChevronRight, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';

type Status = WorkloadResponse['workloadStatus'];

const STATUS: Record<Status, { label: string; tone: BadgeTone; bar: string; icon: JSX.Element }> = {
  Available: { label: 'Available', tone: 'success', bar: 'bg-success-strong', icon: <FiCheckCircle /> },
  PartiallyLoaded: { label: 'Partially loaded', tone: 'warning', bar: 'bg-warning-strong', icon: <FiAlertCircle /> },
  FullyLoaded: { label: 'Fully loaded', tone: 'warning', bar: 'bg-warning-strong', icon: <FiAlertCircle /> },
  Overloaded: { label: 'Overloaded', tone: 'danger', bar: 'bg-danger', icon: <FiXCircle /> },
};

// Thresholds from the service's own status bands.
const BANDS = [30, 60, 85];

/**
 * Workload score as a capacity bar: how full someone is on a 0–100 scale, with
 * the three band edges marked so "nearly overloaded" is visible, not just the
 * colour. The number and status are always printed beside it.
 */
const CapacityBar = ({ score, status }: { score: number; status: Status }) => (
  <div className="flex items-center gap-3 min-w-[180px]">
    <div className="relative flex-1 h-2 rounded-full bg-surface-sunken" role="img" aria-label={`Workload ${score.toFixed(0)} of 100`}>
      <div className={`absolute inset-y-0 left-0 rounded-full ${STATUS[status]?.bar ?? 'bg-primary'}`} style={{ width: `${Math.min(100, Math.max(2, score))}%` }} />
      {BANDS.map((b) => (
        <span key={b} aria-hidden="true" className="absolute -top-0.5 -bottom-0.5 w-[2px] bg-surface" style={{ left: `${b}%` }} />
      ))}
    </div>
    <span className="w-10 text-right font-mono text-meta text-ink tabular">{score.toFixed(0)}</span>
  </div>
);

const WorkloadConfiguration = () => {
  const { members, loading: membersLoading } = useMembers();
  const [workloads, setWorkloads] = useState<Map<string, WorkloadResponse>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // One request per member, all in flight at once — the list used to fill in one
  // row at a time.
  const loadAllWorkloads = useCallback(async () => {
    setRefreshing(true);
    const results = await Promise.allSettled(members.map((m) => workloadService.getByMemberId(m.memberId)));
    const next = new Map<string, WorkloadResponse>();
    results.forEach((result, i) => {
      const member = members[i];
      if (result.status === 'fulfilled') {
        next.set(member.memberId, result.value);
      } else {
        console.error(`Failed to load workload for member ${member.memberId}:`, result.reason);
        toast.error(`Failed to load workload for ${member.firstName} ${member.lastName}`);
      }
    });
    setWorkloads(next);
    setRefreshing(false);
  }, [members]);

  useEffect(() => {
    if (members.length > 0) {
      loadAllWorkloads();
    }
  }, [members, loadAllWorkloads]);

  const term = searchTerm.toLowerCase();
  const filteredMembers = members.filter(
    (member) =>
      member.firstName.toLowerCase().includes(term) ||
      member.lastName.toLowerCase().includes(term) ||
      member.email.toLowerCase().includes(term) ||
      (member.teamName && member.teamName.toLowerCase().includes(term))
  );

  // Grouped by team, because a stage's work is shared out within its team — the
  // comparison that matters is between teammates, lightest first.
  const groups = useMemo(() => {
    const byTeam = new Map<string, { name: string; members: Member[] }>();
    filteredMembers.forEach((m) => {
      const key = m.teamId || 'none';
      if (!byTeam.has(key)) byTeam.set(key, { name: m.teamName || 'No team', members: [] });
      byTeam.get(key)!.members.push(m);
    });
    const score = (m: Member) => workloads.get(m.memberId)?.workloadScore ?? Number.MAX_SAFE_INTEGER;
    return [...byTeam.entries()]
      .map(([key, g]) => ({ key, ...g, members: [...g.members].sort((a, b) => score(a) - score(b)) }))
      .sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name)));
  }, [filteredMembers, workloads]);

  const counts = useMemo(() => {
    const all = [...workloads.values()];
    return {
      overloaded: all.filter((w) => w.workloadStatus === 'Overloaded').length,
      available: all.filter((w) => w.workloadStatus === 'Available').length,
    };
  }, [workloads]);

  const selectedWorkload = selectedMemberId ? workloads.get(selectedMemberId) : null;
  const selectedMember = selectedMemberId ? members.find((m) => m.memberId === selectedMemberId) : null;

  if (membersLoading) {
    return <LoadingSpinner label="Loading workload" />;
  }

  return (
    <div>
      <PageHeader
        title="Workload"
        subtitle="How loaded each member is. This is what decides who unassigned work goes to."
        meta={
          workloads.size > 0 ? (
            <>
              <span>{counts.available} available</span>
              {counts.overloaded > 0 && <span className="text-danger font-medium">{counts.overloaded} overloaded</span>}
            </>
          ) : undefined
        }
        actions={
          <Button variant="secondary" loading={refreshing} icon={<FiRefreshCw />} onClick={loadAllWorkloads}>
            Refresh
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <SearchInput label="Search members" placeholder="Search by name, email or team" value={searchTerm} onChange={setSearchTerm} className="w-full sm:w-72" />
        <ul aria-label="Workload bands" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-subtle">
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-success-strong" />Available &lt; 30</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning-strong" />Partially / fully loaded 30–85</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger" />Overloaded ≥ 85</li>
        </ul>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FiActivity />} title="No members found" body={members.length === 0 ? 'Workload appears once there are members.' : 'Nobody matches that search.'} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] gap-x-6 px-5 h-10 items-center bg-surface-muted border-b border-line">
            <span className="eyebrow">Member</span>
            <span className="eyebrow">Workload score</span>
            <span className="eyebrow">Status</span>
            <span className="eyebrow">Tasks</span>
            <span />
          </div>
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`wl-${group.key}`} className="border-b border-line last:border-b-0">
              <header className="flex items-center justify-between px-5 pt-3 pb-1">
                <h2 id={`wl-${group.key}`} className="eyebrow !text-ink-muted">{group.name}</h2>
                {group.members.length > 1 && (
                  <span className="text-[11px] text-ink-subtle tabular">{group.members.length} members · lightest first</span>
                )}
              </header>
              <ul className="divide-y divide-line-subtle">
                {group.members.map((member, index) => {
                  const workload = workloads.get(member.memberId);
                  const status = workload ? STATUS[workload.workloadStatus] : undefined;
                  return (
                    <li key={member.memberId}>
                      <button
                        type="button"
                        disabled={!workload}
                        onClick={() => setSelectedMemberId(member.memberId)}
                        className="group w-full grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_1.5rem] gap-x-6 gap-y-2 items-center px-5 py-3 text-left hover:bg-surface-muted disabled:cursor-default cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={`${member.firstName} ${member.lastName}`} size="md" />
                          <div className="min-w-0">
                            <p className="text-body font-medium text-ink truncate">
                              {member.firstName} {member.lastName}
                              {index === 0 && workload && group.members.length > 1 && (
                                <span className="ml-2 align-middle"><Badge tone="primary">Lightest load</Badge></span>
                              )}
                            </p>
                            <p className="text-meta text-ink-subtle truncate">{member.email}</p>
                          </div>
                        </div>
                        {workload ? (
                          <>
                            <CapacityBar score={workload.workloadScore} status={workload.workloadStatus} />
                            <div>{status && <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>}</div>
                            <div className="text-meta text-ink-muted tabular">
                              <span className="font-medium text-ink">{workload.metrics.activeTaskCount}</span> active
                              {workload.metrics.overdueTaskCount > 0 && (
                                <span className="text-danger"> · {workload.metrics.overdueTaskCount} overdue</span>
                              )}
                            </div>
                            <FiChevronRight aria-hidden="true" className="hidden md:block text-ink-subtle opacity-0 group-hover:opacity-100" />
                          </>
                        ) : (
                          <span className="md:col-span-4 text-meta text-ink-subtle">
                            {refreshing ? 'Calculating…' : 'Not calculated'}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {selectedWorkload && selectedMember && (
        <Modal
          isOpen
          title={`${selectedMember.firstName} ${selectedMember.lastName}`}
          description={selectedMember.teamName || undefined}
          onClose={() => setSelectedMemberId(null)}
          footer={
            <Button variant="primary" onClick={() => setSelectedMemberId(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="eyebrow">Workload score</span>
                <Badge tone={STATUS[selectedWorkload.workloadStatus].tone} icon={STATUS[selectedWorkload.workloadStatus].icon}>
                  {STATUS[selectedWorkload.workloadStatus].label}
                </Badge>
              </div>
              <CapacityBar score={selectedWorkload.workloadScore} status={selectedWorkload.workloadStatus} />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-body">
              <p className="text-ink-subtle">Efficiency</p>
              <p className="text-right font-mono tabular">{(selectedWorkload.metrics.efficiency * 100).toFixed(1)}%</p>
              <p className="text-ink-subtle">Completion rate</p>
              <p className="text-right font-mono tabular">{(selectedWorkload.metrics.taskCompletionRate * 100).toFixed(1)}%</p>
              <p className="text-ink-subtle">Skill</p>
              <p className="text-right"><SkillMeter level={selectedWorkload.metrics.skillLevel} showLabel={false} /></p>
            </div>

            <div>
              <p className="eyebrow mb-2">Task counts</p>
              <dl className="rounded-card border border-line divide-y divide-line-subtle">
                {[
                  ['Active', selectedWorkload.metrics.activeTaskCount, ''],
                  ['Pending', selectedWorkload.metrics.pendingTaskCount, ''],
                  ['Completed', selectedWorkload.metrics.completedTaskCount, ''],
                  ['Escalated', selectedWorkload.metrics.escalatedTaskCount, 'text-warning'],
                  ['Overdue', selectedWorkload.metrics.overdueTaskCount, 'text-danger'],
                ].map(([label, value, tone]) => (
                  <div key={label as string} className="flex items-center justify-between px-4 py-2">
                    <dt className="text-body text-ink-muted">{label}</dt>
                    <dd className={`font-mono text-body tabular ${Number(value) > 0 ? tone || 'text-ink' : 'text-ink-subtle'}`}>{value}</dd>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2 bg-surface-muted">
                  <dt className="text-body font-medium text-ink">Total</dt>
                  <dd className="font-mono text-body font-semibold tabular">{selectedWorkload.metrics.totalTaskCount}</dd>
                </div>
              </dl>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WorkloadConfiguration;
