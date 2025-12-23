import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiActivity, FiAlertTriangle } from 'react-icons/fi';
import { ManagedTask } from '../types';
import { taskManagerService } from '../services/taskManagerService';
import LoadingSpinner from '../components/LoadingSpinner';

const TaskManagerList = () => {
  const [tasks, setTasks] = useState<ManagedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await taskManagerService.getAll();
        setTasks(data);
      } catch (err: any) {
        console.error('Failed to load managed tasks', err);
        setError(err?.response?.data?.error || 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, []);

  const getStatusBadgeClasses = (status: string, isOverdue: boolean) => {
    if (isOverdue) {
      return 'bg-red-100 text-red-800 border-red-300';
    }

    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'open':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const isTaskOverdue = (task: ManagedTask): boolean => {
    if (!task.slaResolutionTimeMinutes) return false;
    const created = new Date(task.createdAt).getTime();
    const deadline = created + task.slaResolutionTimeMinutes * 60 * 1000;
    return Date.now() > deadline && task.status.toLowerCase() !== 'completed';
  };

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDuration = (minutes?: number) => {
    if (!minutes || minutes <= 0) return 'Not set';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) return `${days}d`;
      return `${days}d ${remainingHours}h`;
    }
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#434E78]/20">
          <div>
            <h1 className="text-3xl font-semibold text-black mb-1 font-sans tracking-tight">
              Task Manager
            </h1>
            <p className="text-black/70 text-sm font-sans">
              Observe tasks, their assigned workflows and SLA status
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-azure-sm bg-red-50 border border-red-200 text-red-700 text-sm font-sans">
            {error}
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="bg-white rounded-azure-sm shadow-azure-sm p-12 text-center border border-[#434E78]/20">
            <div className="max-w-md mx-auto">
              <div className="bg-[#434E78]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FiActivity className="text-3xl text-[#434E78]" />
              </div>
              <h3 className="text-lg font-semibold text-black mb-2 font-sans">
                No managed tasks yet
              </h3>
              <p className="text-black/70 text-sm font-sans">
                Tasks will appear here once they are received and evaluated against workflows.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Task ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Workflow
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      SLA
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map((task) => {
                    const overdue = isTaskOverdue(task);
                    const statusClasses = getStatusBadgeClasses(task.status, overdue);
                    const slaText = task.slaResponseTimeMinutes
                      ? `${task.slaPriority ?? 'N/A'} • ${formatDuration(task.slaResponseTimeMinutes)}`
                      : 'Not configured';

                    return (
                      <tr
                        key={task.taskId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/task-manager/tasks/${task.taskId}`)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                          #{task.taskId}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{task.title}</span>
                            {overdue && (
                              <span className="inline-flex items-center text-xs text-red-700">
                                <FiAlertTriangle className="mr-1" />
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {task.workflowName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {slaText}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-azure-sm border text-xs font-medium ${statusClasses}`}
                          >
                            {overdue ? 'Overdue' : task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(task.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManagerList;


