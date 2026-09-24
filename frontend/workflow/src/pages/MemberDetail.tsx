import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { memberService } from '../services/memberService';
import { Member, Task } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import Tabs from '../components/Tabs';
import DataTable, { Column } from '../components/DataTable';
import EmptyState from '../components/EmptyState';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import SkillMeter from '../components/SkillMeter';
import { toast } from 'react-toastify';
import { FiAlertCircle, FiCheckCircle, FiClock, FiInbox, FiMail, FiUsers, FiZap } from 'react-icons/fi';
import { formatDateToIST, relativeDue } from '../utils/dateUtils';
import { humanizeStatus, priorityRank, priorityTone, statusTone } from '../utils/status';

type Bucket = 'current' | 'overdue' | 'pending' | 'escalated' | 'completed';

const categorizeTasks = (tasks: Task[]): Record<Bucket, Task[]> => ({
  current: tasks.filter((t) => {
    const status = t.status.toLowerCase();
    return (status.includes('progress') || status.includes('active') || status.includes('assigned')) && !t.isOverdue;
  }),
  overdue: tasks.filter((t) => t.isOverdue || t.status.toLowerCase().includes('overdue')),
  pending: tasks.filter((t) => {
    const status = t.status.toLowerCase();
    return status.includes('pending') || status.includes('created') || status.includes('assigned');
  }),
  escalated: tasks.filter((t) => t.status.toLowerCase().includes('escalated')),
  completed: tasks.filter((t) => {
    const status = t.status.toLowerCase();
    return status.includes('completed') || status.includes('done');
  }),
});

const BUCKETS: { id: Bucket; label: string; icon: JSX.Element; empty: string }[] = [
  { id: 'current', label: 'Current', icon: <FiClock />, empty: 'Nothing in progress right now.' },
  { id: 'overdue', label: 'Overdue', icon: <FiAlertCircle />, empty: 'Nothing is past its due date.' },
  { id: 'pending', label: 'Pending', icon: <FiInbox />, empty: 'Nothing waiting to start.' },
  { id: 'escalated', label: 'Escalated', icon: <FiZap />, empty: 'Nothing has been escalated.' },
  { id: 'completed', label: 'Completed', icon: <FiCheckCircle />, empty: 'Nothing completed yet.' },
];

const MemberDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket | null>(null);

  useEffect(() => {
    const fetchMemberData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [memberData, tasksData] = await Promise.all([memberService.getById(id), memberService.getTasks(id)]);
        setMember(memberData);
        setMemberTasks(tasksData);
      } catch (error: any) {
        toast.error('Failed to load member details');
        navigate('/members');
      } finally {
        setLoading(false);
      }
    };

    fetchMemberData();
  }, [id, navigate]);

  const categorized = useMemo(() => categorizeTasks(memberTasks), [memberTasks]);

  // Open on the most urgent bucket that has anything in it.
  useEffect(() => {
    if (bucket || memberTasks.length === 0) return;
    const first = (['overdue', 'current', 'pending', 'escalated', 'completed'] as Bucket[]).find((b) => categorized[b].length > 0);
    setBucket(first ?? 'current');
  }, [categorized, bucket, memberTasks.length]);

  if (loading) {
    return <LoadingSpinner label="Loading member" />;
  }

  if (!member) {
    return (
      <div className="card">
        <EmptyState icon={<FiUsers />} title="Member not found" />
      </div>
    );
  }

  const fullName = `${member.firstName} ${member.lastName}`;
  const active = bucket ?? 'current';

  const columns: Column<Task>[] = [
    {
      key: 'task',
      header: 'Enquiry',
      sortValue: (t) => t.taskName.toLowerCase(),
      render: (t) => (
        <div className="min-w-0 max-w-md">
          <p className="font-semibold text-ink truncate">{t.taskName}</p>
          {t.description && <p className="text-meta text-ink-subtle line-clamp-1">{t.description}</p>}
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      hideOnMobile: true,
      sortValue: (t) => t.stageName ?? '',
      render: (t) => <span className="text-ink-muted">{t.stageName || 'No stage'}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortValue: (t) => priorityRank(t.priority),
      render: (t) => <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => (
        <Badge dot tone={statusTone(t.status, t.isOverdue)}>
          {t.isOverdue ? 'Overdue' : humanizeStatus(t.status)}
        </Badge>
      ),
    },
    active === 'completed'
      ? {
          key: 'completed',
          header: 'Completed',
          align: 'right',
          hideOnMobile: true,
          sortValue: (t) => t.updatedAt,
          render: (t) => <span className="text-meta text-ink-muted">{formatDateToIST(t.updatedAt)}</span>,
        }
      : {
          key: 'due',
          header: 'Due',
          align: 'right',
          hideOnMobile: true,
          sortValue: (t) => t.dueDate ?? '',
          render: (t) => {
            const due = relativeDue(t.dueDate);
            if (!t.dueDate) return <span className="text-ink-subtle">No due date</span>;
            return (
              <div className="leading-tight">
                {due && <p className={`text-meta font-medium ${due.tone === 'danger' ? 'text-danger' : due.tone === 'warning' ? 'text-warning' : 'text-ink-muted'}`}>{due.label}</p>}
                <p className="text-[11px] text-ink-subtle">{formatDateToIST(t.dueDate)}</p>
              </div>
            );
          },
        },
  ];

  const current = BUCKETS.find((b) => b.id === active)!;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Members', to: '/members' }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={fullName} size="lg" />
            <span className="min-w-0">
              <span className="block">{fullName}</span>
              <span className="block text-body font-normal text-ink-muted">{member.role}</span>
            </span>
          </span>
        }
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiMail aria-hidden="true" />{member.email}</span>
            <span className="inline-flex items-center gap-1.5"><FiUsers aria-hidden="true" />{member.teamName || 'Unassigned'}</span>
            <SkillMeter level={member.skillLevel} />
            {!member.userId && <Badge tone="warning">No linked login</Badge>}
          </>
        }
      />

      {memberTasks.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FiInbox />} title="No tasks assigned to this member" body="Enquiries appear here once a stage is assigned to them." />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <Tabs
              label="Tasks by status"
              activeId={active}
              onChange={(v) => setBucket(v as Bucket)}
              tabs={BUCKETS.map((b) => ({ id: b.id, label: b.label, icon: b.icon, count: categorized[b.id].length }))}
            />
          </div>
          <DataTable<Task>
            caption={`${current.label} tasks for ${fullName}`}
            columns={columns}
            rows={categorized[active]}
            rowKey={(t) => t.taskId}
            onRowClick={(t) => navigate(`/tasks/${t.taskId}`)}
            rowTone={(t) => (t.isOverdue ? 'danger' : undefined)}
            empty={<EmptyState compact icon={current.icon} title={current.empty} />}
          />
        </>
      )}
    </div>
  );
};

export default MemberDetail;
