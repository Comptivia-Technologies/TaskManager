import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { memberService } from '../services/memberService';
import { taskService } from '../services/taskService';
import { Member, Task } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskAuditModal from '../components/TaskAuditModal';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiUser, FiClock } from 'react-icons/fi';
import { formatDateToIST } from '../utils/dateUtils';

type MemberTaskStatus = 'Assigned' | 'Stage completed' | 'Escalated';

type MemberTaskRow = {
  task: Task;
  memberStatus: MemberTaskStatus;
};

const MemberDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [completedByMeTasks, setCompletedByMeTasks] = useState<Task[]>([]);
  const [escalatedByMeTasks, setEscalatedByMeTasks] = useState<Task[]>([]);
  const [auditTask, setAuditTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [memberData, tasksData] = await Promise.all([
          memberService.getById(id),
          memberService.getTasks(id),
        ]);
        setMember(memberData);
        setMemberTasks(tasksData);

        const currentIds = new Set((tasksData as Task[]).map((t) => t.taskId));
        try {
          const summary = await taskService.getMemberSummary(id);
          setCompletedByMeTasks(
            summary.completedByMe.filter((t) => !currentIds.has(t.taskId))
          );
          setEscalatedByMeTasks(
            summary.escalatedByMe.filter((t) => !currentIds.has(t.taskId))
          );
        } catch {
          setCompletedByMeTasks([]);
          setEscalatedByMeTasks([]);
        }
      } catch (error: any) {
        toast.error('Failed to load member details');
        navigate('/members');
      } finally {
        setLoading(false);
      }
    };

    fetchMemberData();
  }, [id, navigate]);

  const getDisplayStatus = (task: Task) =>
    task.isOverdue || task.status.toLowerCase().includes('overdue') ? 'Overdue' : task.status;

  const getDaysOverdue = (dueDate?: string) => {
    if (!dueDate) return null;
    const days = Math.floor(
      (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days > 0 ? days : 0;
  };

  const getStatusColor = (status: string, isOverdue?: boolean) => {
    if (isOverdue) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    const statusLower = status.toLowerCase();
    if (statusLower.includes('completed') || statusLower.includes('done')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (statusLower.includes('progress') || statusLower.includes('active')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (statusLower.includes('assigned') || statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (statusLower.includes('escalated')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    if (statusLower.includes('overdue')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getMemberActionColor = (memberStatus: MemberTaskStatus) => {
    if (memberStatus === 'Assigned') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (memberStatus === 'Stage completed') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  const getPriorityColor = (priority: string) => {
    const priorityLower = priority.toLowerCase();
    if (priorityLower.includes('critical') || priorityLower.includes('very critical')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (priorityLower.includes('high')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (priorityLower.includes('medium')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (priorityLower.includes('low')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!member) {
    return (
      <div className="p-8">
        <p className="text-center text-gray-500">Member not found</p>
      </div>
    );
  }

  const memberTaskRows: MemberTaskRow[] = (() => {
    const assignedRows: MemberTaskRow[] = memberTasks.map((task) => ({
      task,
      memberStatus: 'Assigned',
    }));

    const pastByTaskId = new Map<string, MemberTaskRow>();
    completedByMeTasks.forEach((task) => {
      pastByTaskId.set(task.taskId, { task, memberStatus: 'Stage completed' });
    });
    escalatedByMeTasks.forEach((task) => {
      pastByTaskId.set(task.taskId, { task, memberStatus: 'Escalated' });
    });

    return [...assignedRows, ...Array.from(pastByTaskId.values())];
  })();

  const hasAnyTasks = memberTaskRows.length > 0;
  const memberDisplayName = `${member.firstName} ${member.lastName}`;

  const renderMemberTasksTable = (rows: MemberTaskRow[]) => (
    <div className="bg-white rounded-azure-sm border border-[#434E78]/20 overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[960px]">
          <thead className="bg-[#434E78]/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Task</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">
                Member status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">
                Current status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">
                Current stage
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Due date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Days overdue</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">
                Currently assigned to
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-black uppercase w-14">
                <span className="sr-only">History</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#434E78]/10">
            {rows.map(({ task, memberStatus }) => {
              const displayStatus = getDisplayStatus(task);
              const daysOverdue = getDaysOverdue(task.dueDate);
              const showOverdue = task.isOverdue || displayStatus === 'Overdue';
              const assignedTo =
                memberStatus === 'Assigned'
                  ? task.assignedToMemberName || memberDisplayName
                  : task.assignedToMemberName || '—';

              return (
                <tr key={`${task.taskId}-${memberStatus}`} className="hover:bg-[#434E78]/5">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-black font-sans">{task.taskName}</div>
                    {task.description && (
                      <div className="text-xs text-black/60 font-sans mt-1 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getMemberActionColor(
                        memberStatus
                      )} font-sans`}
                    >
                      {memberStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getStatusColor(
                        displayStatus,
                        showOverdue
                      )} font-sans`}
                    >
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(
                        task.priority
                      )} font-sans`}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-black/70 font-sans">
                    {task.stageName || 'No stage'}
                  </td>
                  <td className="px-4 py-3 text-sm text-black/70 font-sans">
                    {task.dueDate ? formatDateToIST(task.dueDate) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-sans">
                    {showOverdue && daysOverdue !== null ? (
                      <span className="font-semibold text-red-600">
                        {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}
                      </span>
                    ) : (
                      <span className="text-black/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-black/70 font-sans">{assignedTo}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      title="View task history"
                      aria-label={`View history for ${task.taskName}`}
                      onClick={() => setAuditTask(task)}
                      className="inline-flex items-center justify-center text-[#434E78]/70 hover:text-[#434E78] hover:bg-[#434E78]/10 p-2 rounded-azure-sm transition-colors"
                    >
                      <FiClock className="text-lg" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-8 bg-white font-sans w-full min-w-0">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-azure-sm shadow-azure-sm p-6 mb-6 border border-[#434E78]/20">
          <button
            onClick={() => navigate('/members')}
            className="mb-4 flex items-center text-[#434E78] hover:text-[#434E78]/80 font-medium transition-colors font-sans text-sm"
          >
            <FiArrowLeft className="mr-2" />
            Back to Members
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-black mb-2 font-sans tracking-tight">
                {member.firstName} {member.lastName}
              </h1>
              <p className="text-black/70 text-base mb-4 font-sans">{member.email}</p>
              
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <span className="text-black/60 mr-2 font-sans">Team:</span>
                  <span className="font-semibold text-black bg-[#434E78]/10 px-2.5 py-1 rounded-azure-sm text-xs font-sans">
                    {member.teamName || 'Unassigned'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black/60 mr-2 font-sans">Role:</span>
                  <span className="font-semibold text-black font-sans">{member.role}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-black/60 mr-2 font-sans">Skill Level:</span>
                  <span className="font-semibold text-black bg-[#434E78]/10 px-2.5 py-1 rounded-azure-sm text-xs font-sans">
                    {member.skillLevel}/5
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black/60 mr-2 font-sans">Total Tasks:</span>
                  <span className="font-semibold text-black bg-[#434E78]/10 px-2.5 py-1 rounded-azure-sm text-xs font-sans">
                    {memberTaskRows.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {hasAnyTasks && (
            <div>
              <h3 className="text-lg font-semibold text-black font-sans mb-3 flex items-center">
                <FiClock className="mr-2 text-[#434E78]" />
                Tasks ({memberTaskRows.length})
              </h3>
              <p className="text-sm text-black/60 font-sans mb-3">
                Assigned work and past involvement in one list. Member status is what this member did;
                current status, stage, and assignee reflect the task today. Overdue appears in current status.
              </p>
              {renderMemberTasksTable(memberTaskRows)}
            </div>
          )}

          {!hasAnyTasks && (
            <div className="text-center py-12 bg-white rounded-azure-sm border border-[#434E78]/20">
              <FiUser className="text-4xl text-black/40 mx-auto mb-4" />
              <p className="text-black/60 font-sans">No task history for this member yet</p>
            </div>
          )}
        </div>
      </div>

      {auditTask && (
        <TaskAuditModal
          taskId={auditTask.taskId}
          taskName={auditTask.taskName}
          onClose={() => setAuditTask(null)}
        />
      )}
    </div>
  );
};

export default MemberDetail;
