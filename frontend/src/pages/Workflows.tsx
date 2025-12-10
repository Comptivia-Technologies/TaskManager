import { useState } from 'react';
import { useWorkflows } from '../hooks/useWorkflows';
import { workflowService } from '../services/workflowService';
import { Workflow } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiPlus, FiTrash2, FiLayers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import WorkflowCreate from '../components/WorkflowCreate';

const Workflows = () => {
  const { workflows, loading, refetch } = useWorkflows();
  const [isCreateMode, setIsCreateMode] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) {
      try {
        await workflowService.delete(id);
        toast.success('Workflow deleted successfully');
        refetch();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Failed to delete workflow');
      }
    }
  };

  const handleCreateSuccess = (workflowId: number) => {
    setIsCreateMode(false);
    refetch();
    navigate(`/workflows/${workflowId}`);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isCreateMode) {
    return (
      <WorkflowCreate
        onSuccess={handleCreateSuccess}
        onCancel={() => setIsCreateMode(false)}
      />
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 font-sans">Workflows</h1>
            <p className="text-gray-600 font-sans">Manage and track your workflow processes</p>
          </div>
          <button
            onClick={() => setIsCreateMode(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center shadow-md hover:shadow-lg transition-all"
          >
            <FiPlus className="mr-2 text-lg" />
            Create Workflow
          </button>
        </div>

        {workflows.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <FiLayers className="text-4xl text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No workflows yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first workflow to start organizing your tasks and processes.
              </p>
              <button
                onClick={() => setIsCreateMode(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center shadow-md hover:shadow-lg transition-all"
              >
                <FiPlus className="mr-2" />
                Create Your First Workflow
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <div
                key={workflow.workflowId}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer border border-gray-200 overflow-hidden group"
                onClick={() => navigate(`/workflows/${workflow.workflowId}`)}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {workflow.workflowName}
                    </h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(workflow.workflowId);
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                      title="Delete workflow"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                  
                  <p className="text-gray-600 mb-6 text-sm line-clamp-2">
                    {workflow.description || 'No description provided'}
                  </p>
                  
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    {workflow.teamName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Team</span>
                        <span className="font-medium text-gray-900">{workflow.teamName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 mr-2">Stages:</span>
                          <span className="font-semibold text-gray-900 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {workflow.stages?.length || 0}
                          </span>
                        </div>
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 mr-2">Tasks:</span>
                          <span className="font-semibold text-gray-900 bg-green-50 text-green-700 px-2 py-1 rounded">
                            {workflow.tasks?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                  <span className="text-sm text-blue-600 font-medium group-hover:text-blue-700">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Workflows;

