import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { memberService } from '../services/memberService';
import { Member, Task } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiUser, FiCheckCircle, FiClock, FiAlertCircle, FiCalendar, FiLayers } from 'react-icons/fi';
import { formatDateToIST, formatDateOnlyIST } from '../utils/dateUtils';

const MemberDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [memberTasks, setMemberTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [memberData, tasksData] = await Promise.all([
          memberService.getById(id),
          memberService.getTasks(id)
        ]);
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

  const categorizeTasks = (tasks: Task[]) => {
    return {
      current: tasks.filter(t => {
        const status = t.status.toLowerCase();
        return (status.includes('progress') || status.includes('active') || status.includes('assigned')) && !t.isOverdue;
      }),
      completed: tasks.filter(t => {
        const status = t.status.toLowerCase();
        return status.includes('completed') || status.includes('done');
      }),
      pending: tasks.filter(t => {
        const status = t.status.toLowerCase();
        return status.includes('pending') || status.includes('created') || status.includes('assigned');
      }),
      escalated: tasks.filter(t => {
        const status = t.status.toLowerCase();
        return status.includes('escalated');
      }),
      overdue: tasks.filter(t => t.isOverdue || t.status.toLowerCase().includes('overdue'))
    };
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

  const categorized = categorizeTasks(memberTasks);

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
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
                    {memberTasks.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Categories */}
        <div className="space-y-6">
          {/* Current/In Progress Tasks */}
          {categorized.current.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-black font-sans mb-3 flex items-center">
                <FiClock className="mr-2 text-blue-600" />
                Current Tasks ({categorized.current.length})
              </h3>
              <div className="bg-white rounded-azure-sm border border-[#434E78]/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#434E78]/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Task</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Stage</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#434E78]/10">
                      {categorized.current.map((task) => (
                        <tr key={task.taskId} className="hover:bg-[#434E78]/5">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-black font-sans">{task.taskName}</div>
                            {task.description && (
                              <div className="text-xs text-black/60 font-sans mt-1 line-clamp-1">{task.description}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getStatusColor(task.status, task.isOverdue)} font-sans`}>
                              {task.isOverdue ? 'Overdue' : task.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(task.priority)} font-sans`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-black/70 font-sans">
                            {task.stageName || 'No stage'}
                          </td>
                          <td className="px-4 py-3 text-sm text-black/70 font-sans">
                            {task.dueDate ? formatDateToIST(task.dueDate) : 'No due date'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {categorized.completed.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-black font-sans mb-3 flex items-center">
                <FiCheckCircle className="mr-2 text-green-600" />
                Completed Tasks ({categorized.completed.length})
              </h3>
              <div className="bg-white rounded-azure-sm border border-[#434E78]/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#434E78]/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Task</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#434E78]/10">
                      {categorized.completed.map((task) => (
                        <tr key={task.taskId} className="hover:bg-[#434E78]/5">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-black font-sans">{task.taskName}</div>
                            {task.description && (
                              <div className="text-xs text-black/60 font-sans mt-1 line-clamp-1">{task.description}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(task.priority)} font-sans`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-black/70 font-sans">
                            {formatDateToIST(task.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Pending Tasks */}
          {categorized.pending.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-black font-sans mb-3 flex items-center">
                <FiClock className="mr-2 text-yellow-600" />
                Pending Tasks ({categorized.pending.length})
              </h3>
              <div className="bg-white rounded-azure-sm border border-[#434E78]/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#434E78]/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Task</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#434E78]/10">
                      {categorized.pending.map((task) => (
                        <tr key={task.taskId} className="hover:bg-[#434E78]/5">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-black font-sans">{task.taskName}</div>
                            {task.description && (
                              <div className="text-xs text-black/60 font-sans mt-1 line-clamp-1">{task.description}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getStatusColor(task.status, task.isOverdue)} font-sans`}>
                              {task.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(task.priority)} font-sans`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-black/70 font-sans">
                            {task.dueDate ? formatDateToIST(task.dueDate) : 'No due date'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Escalated Tasks */}
          {categorized.escalated.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-black font-sans mb-3 flex items-center">
                <FiAlertCircle className="mr-2 text-purple-600" />
                Escalated Tasks ({categorized.escalated.length})
              </h3>
              <div className="bg-white rounded-azure-sm border border-[#434E78]/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#434E78]/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Task</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Stage</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#434E78]/10">
                      {categorized.escalated.map((task) => (
                        <tr key={task.taskId} className="hover:bg-[#434E78]/5">
                          <td className="px-4 py-3">
                            <div className="text-sm font-semibold text-black font-sans">{task.taskName}</div>
                            {task.description && (
                              <div className="text-xs text-black/60 font-sans mt-1 line-clamp-1">{task.description}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(task.priority)} font-sans`}>
                              {task.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-black/70 font-sans">
                            {task.stageName || 'No stage'}
                          </td>
                          <td className="px-4 py-3 text-sm text-black/70 font-sans">
                            {task.dueDate ? formatDateToIST(task.dueDate) : 'No due date'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Overdue Tasks */}
          {categorized.overdue.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-black font-sans mb-3 flex items-center">
                <FiAlertCircle className="mr-2 text-red-600" />
                Overdue Tasks ({categorized.overdue.length})
              </h3>
              <div className="bg-white rounded-azure-sm border border-[#434E78]/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#434E78]/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Task</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Due Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase">Days Overdue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#434E78]/10">
                      {categorized.overdue.map((task) => {
                        const daysOverdue = task.dueDate 
                          ? Math.floor((new Date().getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                          : 0;
                        return (
                          <tr key={task.taskId} className="hover:bg-[#434E78]/5">
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-black font-sans">{task.taskName}</div>
                              {task.description && (
                                <div className="text-xs text-black/60 font-sans mt-1 line-clamp-1">{task.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(task.priority)} font-sans`}>
                                {task.priority}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-black/70 font-sans">
                              {task.dueDate ? formatDateToIST(task.dueDate) : 'No due date'}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-600 font-sans">
                              {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {memberTasks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-azure-sm border border-[#434E78]/20">
              <FiUser className="text-4xl text-black/40 mx-auto mb-4" />
              <p className="text-black/60 font-sans">No tasks assigned to this member</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberDetail;
