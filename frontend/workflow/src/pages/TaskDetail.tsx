import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskHistoryGraph, { resolveCurrentStageId } from '../components/TaskHistoryGraph';
import { taskService } from '../services/taskService';
import { workflowService } from '../services/workflowService';
import { Stage, Task, TaskStageHistory, Workflow } from '../types';
import { formatDateToIST } from '../utils/dateUtils';

const statusBadge = (status: string) => {
  if (status === 'Completed') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'Current') return 'bg-[#434E78]/10 text-[#434E78] border-[#434E78]/30';
  return 'bg-gray-100 text-gray-600 border-gray-200';
};

const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [history, setHistory] = useState<TaskStageHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const taskData = await taskService.getById(id);
        const [workflowResult, historyData] = await Promise.all([
          workflowService.getById(taskData.workflowId).catch(() => null),
          taskService.getHistory(id).catch(() => [] as TaskStageHistory[]),
        ]);
        let workflowData = workflowResult;
        if (workflowData && (!workflowData.stages || workflowData.stages.length === 0)) {
          const stageRows = await workflowService.getStages(taskData.workflowId).catch(() => []);
          workflowData = { ...workflowData, stages: stageRows as Stage[] };
        }
        setTask(taskData);
        setWorkflow(workflowData);
        setHistory(historyData);
      } catch (error) {
        toast.error('Failed to load task');
        navigate('/tasks');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

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
          onClick={() => navigate('/tasks')}
          className="mb-4 flex items-center text-[#434E78] hover:text-[#434E78]/80 font-medium text-sm"
        >
          <FiArrowLeft className="mr-2" />
          Back to Tasks
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
                {task.assignedToMemberName || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-xs text-black/60">Due</p>
              <p className="font-semibold text-black">{task.dueDate ? formatDateToIST(task.dueDate) : 'No due date'}</p>
            </div>
          </div>
        </div>

        <TaskHistoryGraph history={history} currentStageId={currentStageId} stages={stages} />

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
                  const latestAssignee = [...history]
                    .reverse()
                    .find((entry) => entry.action === 'Assigned' && (entry.stageId === stage.stageId || entry.toStageId === stage.stageId))
                    ?.memberName;
                  const person = status === 'Current'
                    ? task.assignedToMemberName || latestAssignee || 'Unassigned'
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
    </div>
  );
};

export default TaskDetail;
