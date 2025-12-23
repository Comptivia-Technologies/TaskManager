import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import { ManagedTask } from '../types';
import { taskManagerService } from '../services/taskManagerService';
import LoadingSpinner from '../components/LoadingSpinner';

const TaskManagerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ManagedTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTask = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await taskManagerService.getById(Number(id));
        setTask(data);
      } catch (err: any) {
        console.error('Failed to load managed task', err);
        setError(err?.response?.data?.error || 'Failed to load task');
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [id]);

  const isOverdue = (task: ManagedTask): boolean => {
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

  const computeSlaDeadline = (task: ManagedTask): string | null => {
    if (!task.slaResolutionTimeMinutes) return null;
    const created = new Date(task.createdAt).getTime();
    const deadline = created + task.slaResolutionTimeMinutes * 60 * 1000;
    return new Date(deadline).toLocaleString();
  };

  const stringifyPayload = (payload: unknown) => {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload ?? '');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!task) {
    return (
      <div className="p-8 bg-white min-h-screen font-sans">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/task-manager')}
            className="inline-flex items-center text-sm text-[#434E78] hover:text-[#434E78]/80 mb-4"
          >
            <FiArrowLeft className="mr-1" />
            Back to Task Manager
          </button>
          <div className="bg-red-50 border border-red-200 rounded-azure-sm p-4 text-red-700 text-sm font-sans">
            {error || 'Task not found'}
          </div>
        </div>
      </div>
    );
  }

  const overdue = isOverdue(task);
  const slaDeadline = computeSlaDeadline(task);

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/task-manager')}
          className="inline-flex items-center text-sm text-[#434E78] hover:text-[#434E78]/80 mb-4"
        >
          <FiArrowLeft className="mr-1" />
          Back to Task Manager
        </button>

        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-black mb-1 font-sans tracking-tight">
              Task #{task.taskId}
            </h1>
            <p className="text-black/80 text-lg font-sans">{task.title}</p>
          </div>
          {overdue && (
            <div className="inline-flex items-center px-3 py-1.5 rounded-azure-sm border border-red-300 bg-red-50 text-red-800 text-xs font-medium">
              <FiAlertTriangle className="mr-1.5" />
              SLA Overdue
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-azure-sm p-4 shadow-azure-sm lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 font-sans">Workflow & Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 font-sans mb-1">Workflow</p>
                <p className="text-gray-900 font-medium font-sans">{task.workflowName}</p>
              </div>
              <div>
                <p className="text-gray-500 font-sans mb-1">Status</p>
                <p className="text-gray-900 font-medium font-sans">
                  {overdue ? 'Overdue' : task.status}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-sans mb-1">Priority</p>
                <p className="text-gray-900 font-medium font-sans">{task.priority}</p>
              </div>
              <div>
                <p className="text-gray-500 font-sans mb-1">External Task ID</p>
                <p className="text-gray-900 font-mono text-xs">
                  {task.externalTaskId || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-sans mb-1">Created At</p>
                <p className="text-gray-900 font-medium font-sans">{formatDateTime(task.createdAt)}</p>
              </div>
              <div>
                <p className="text-gray-500 font-sans mb-1">Last Updated</p>
                <p className="text-gray-900 font-medium font-sans">{formatDateTime(task.updatedAt)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-azure-sm p-4 shadow-azure-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 font-sans">SLA Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-500 font-sans mb-1">Priority Level</p>
                <p className="text-gray-900 font-medium font-sans">
                  {task.slaPriority || 'Not configured'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-sans mb-1">Response Time</p>
                <p className="text-gray-900 font-medium font-sans">
                  {formatDuration(task.slaResponseTimeMinutes)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-sans mb-1">Resolution Time</p>
                <p className="text-gray-900 font-medium font-sans">
                  {formatDuration(task.slaResolutionTimeMinutes)}
                </p>
              </div>
              {slaDeadline && (
                <div>
                  <p className="text-gray-500 font-sans mb-1">Resolution Deadline</p>
                  <p className="text-gray-900 font-medium font-sans">{slaDeadline}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-azure-sm p-4 shadow-azure-sm mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2 font-sans">Description</h2>
          <p className="text-sm text-gray-800 font-sans">
            {task.description || 'No description provided.'}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-azure-sm p-4 shadow-azure-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-2 font-sans">Full Task Payload</h2>
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-azure-sm p-3 overflow-auto font-mono text-gray-800">
            {stringifyPayload(task.payload)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default TaskManagerDetail;


