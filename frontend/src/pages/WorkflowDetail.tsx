import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workflowService } from '../services/workflowService';
import { taskService } from '../services/taskService';
import { Workflow, Task, TaskUpdate } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import KanbanBoard from '../components/KanbanBoard';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiCode, FiEye } from 'react-icons/fi';

const WorkflowDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'ui' | 'json'>('ui');

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const data = await workflowService.getById(Number(id));
        setWorkflow(data);
      } catch (error: any) {
        toast.error('Failed to load workflow');
        navigate('/workflows');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchWorkflow();
    }
  }, [id, navigate]);

  const handleTaskMove = async (taskId: number, newStageId: number | null) => {
    if (!workflow) return;

    try {
      const task = workflow.tasks.find((t) => t.taskId === taskId);
      if (!task) return;

      const update: TaskUpdate = {
        taskName: task.taskName,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        stageId: newStageId || undefined,
        assignedToMemberId: task.assignedToMemberId || undefined,
      };

      await taskService.update(taskId, update);

      // Refresh workflow data
      const updatedWorkflow = await workflowService.getById(Number(id));
      setWorkflow(updatedWorkflow);
      toast.success('Task moved successfully');
    } catch (error: any) {
      toast.error('Failed to move task');
    }
  };

  const handleTaskUpdate = async (taskId: number, updates: Partial<TaskUpdate>) => {
    if (!workflow) return;

    try {
      const task = workflow.tasks.find((t) => t.taskId === taskId);
      if (!task) return;

      const update: TaskUpdate = {
        taskName: updates.taskName ?? task.taskName,
        description: updates.description ?? task.description,
        status: updates.status ?? task.status,
        priority: updates.priority ?? task.priority,
        dueDate: updates.dueDate ?? task.dueDate,
        stageId: updates.stageId ?? task.stageId ?? undefined,
        assignedToMemberId: updates.assignedToMemberId ?? task.assignedToMemberId ?? undefined,
      };

      await taskService.update(taskId, update);

      // Refresh workflow data
      const updatedWorkflow = await workflowService.getById(Number(id));
      setWorkflow(updatedWorkflow);
      toast.success('Task updated successfully');
    } catch (error: any) {
      toast.error('Failed to update task');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!workflow) {
    return (
      <div className="p-8">
        <p className="text-center text-gray-500">Workflow not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-full">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <button
            onClick={() => navigate('/workflows')}
            className="mb-4 flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors font-sans"
          >
            <FiArrowLeft className="mr-2" />
            Back to Workflows
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-3 font-sans">{workflow.workflowName}</h1>
              <p className="text-gray-600 text-lg mb-4 font-sans">
                {workflow.description || 'No description provided'}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6 text-sm">
                  {workflow.teamName && (
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-2">Workflow Team:</span>
                      <span className="font-semibold text-gray-900 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg">
                        {workflow.teamName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">Stages:</span>
                    <span className="font-semibold text-gray-900 bg-purple-50 text-purple-700 px-3 py-1 rounded-lg">
                      {workflow.stages?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">Tasks:</span>
                    <span className="font-semibold text-gray-900 bg-green-50 text-green-700 px-3 py-1 rounded-lg">
                      {workflow.tasks?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-2">Created:</span>
                    <span className="font-semibold text-gray-900">
                      {new Date(workflow.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('ui')}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      viewMode === 'ui'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FiEye className="mr-2" />
                    UI View
                  </button>
                  <button
                    onClick={() => setViewMode('json')}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                      viewMode === 'json'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FiCode className="mr-2" />
                    JSON View
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          {viewMode === 'ui' ? (
            <KanbanBoard
              workflow={workflow}
              onTaskMove={handleTaskMove}
              onTaskUpdate={handleTaskUpdate}
            />
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 font-sans">JSON View</h2>
                  <p className="text-sm text-gray-600 mt-1 font-sans">
                    Complete workflow structure with all relationships
                  </p>
                </div>
                <button
                  onClick={() => {
                    const jsonWithTeamNames = {
                      ...workflow,
                      stages: workflow.stages?.map(stage => ({
                        ...stage,
                        teamName: stage.teamName || 'No Team Assigned'
                      })) || []
                    };
                    navigator.clipboard.writeText(JSON.stringify(jsonWithTeamNames, null, 2));
                    toast.success('JSON copied to clipboard!');
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <FiCode className="mr-1" />
                  Copy JSON
                </button>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-[600px] border border-gray-200">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      ...workflow,
                      stages: workflow.stages?.map(stage => ({
                        ...stage,
                        teamName: stage.teamName || 'No Team Assigned'
                      })) || []
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowDetail;

