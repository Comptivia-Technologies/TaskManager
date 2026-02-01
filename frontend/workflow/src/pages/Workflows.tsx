import { useState } from 'react';
import { useWorkflows } from '../hooks/useWorkflows';
import { workflowService } from '../services/workflowService';
import { Workflow } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiPlus, FiTrash2, FiLayers, FiEdit, FiClock, FiSettings } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import WorkflowWizard from '../components/WorkflowWizard';
import WorkflowEdit from '../components/WorkflowEdit';
import SLAConfigure from '../components/SLAConfigure';

const Workflows = () => {
  const { workflows, loading, refetch } = useWorkflows();
  const [isWizardMode, setIsWizardMode] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [isSLAConfigureMode, setIsSLAConfigureMode] = useState(false);
  const [selectedWorkflowForSLA, setSelectedWorkflowForSLA] = useState<number | undefined>(undefined);
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

  const handleWizardSuccess = (workflowId: number) => {
    setIsWizardMode(false);
    refetch();
    navigate(`/workflows/${workflowId}`);
  };

  const handleEditSuccess = () => {
    setEditingWorkflow(null);
    refetch();
  };

  const handleSLASuccess = () => {
    setIsSLAConfigureMode(false);
    setSelectedWorkflowForSLA(undefined);
    refetch();
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isWizardMode) {
    return (
      <WorkflowWizard
        onSuccess={handleWizardSuccess}
        onCancel={() => setIsWizardMode(false)}
      />
    );
  }

  if (isSLAConfigureMode) {
    return (
      <SLAConfigure
        onSuccess={handleSLASuccess}
        onCancel={() => {
          setIsSLAConfigureMode(false);
          setSelectedWorkflowForSLA(undefined);
        }}
        initialWorkflowId={selectedWorkflowForSLA}
      />
    );
  }

  if (editingWorkflow) {
    return (
      <WorkflowEdit
        workflow={editingWorkflow}
        onSuccess={handleEditSuccess}
        onCancel={() => setEditingWorkflow(null)}
      />
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#434E78]/20">
          <div>
            <h1 className="text-3xl font-semibold text-black mb-1 font-sans tracking-tight">Workflows</h1>
            <p className="text-black/70 text-sm font-sans">Manage and track your workflow processes</p>
          </div>
          <div className="flex gap-3">
            {workflows.length > 0 && (
              <>
                <button
                  onClick={() => {
                    // If only one workflow, select it; otherwise let user choose in modal
                    if (workflows.length === 1) {
                      setSelectedWorkflowForSLA(workflows[0].workflowId);
                    } else {
                      setSelectedWorkflowForSLA(undefined);
                    }
                    setIsSLAConfigureMode(true);
                  }}
                  className="bg-emerald-600 text-white px-5 py-2.5 rounded-azure-sm hover:bg-emerald-700 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
                >
                  <FiClock className="mr-2 text-base" />
                  Configure SLA
                </button>
                <button
                  onClick={() => {
                    navigate('/priority-rules');
                  }}
                  className="bg-purple-600 text-white px-5 py-2.5 rounded-azure-sm hover:bg-purple-700 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
                >
                  <FiSettings className="mr-2 text-base" />
                  Add Rule
                </button>
              </>
            )}
            <button
              onClick={() => setIsWizardMode(true)}
              className="bg-[#434E78] text-white px-5 py-2.5 rounded-azure-sm hover:bg-[#434E78]/90 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
            >
              <FiPlus className="mr-2 text-base" />
              {workflows.length === 0 ? 'Get Started' : 'Create Workflow'}
            </button>
          </div>
        </div>

        {workflows.length === 0 ? (
          <div className="bg-white rounded-azure-sm shadow-azure-sm p-12 text-center border border-[#434E78]/20">
            <div className="max-w-md mx-auto">
              <div className="bg-[#434E78]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FiLayers className="text-3xl text-[#434E78]" />
              </div>
              <h3 className="text-lg font-semibold text-black mb-2 font-sans">No workflows yet</h3>
              <p className="text-black/70 mb-6 text-sm font-sans">
                Create your first workflow to start organizing your tasks and processes.
              </p>
              <button
                onClick={() => setIsWizardMode(true)}
                className="bg-[#434E78] text-white px-5 py-2.5 rounded-azure-sm hover:bg-[#434E78]/90 inline-flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
              >
                <FiPlus className="mr-2" />
                Get Started
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.workflowId}
                className="bg-white rounded-azure-sm shadow-azure-sm hover:shadow-azure-md transition-all duration-200 cursor-pointer border border-[#434E78]/20 overflow-hidden group"
                onClick={() => navigate(`/workflows/${workflow.workflowId}`)}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-lg font-semibold text-black group-hover:text-black/80 transition-colors font-sans">
                      {workflow.workflowName}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWorkflow(workflow);
                        }}
                        className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-1.5 rounded-azure-sm transition-colors"
                        title="Edit workflow"
                      >
                        <FiEdit className="text-base" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(workflow.workflowId);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-azure-sm transition-colors"
                        title="Delete workflow"
                      >
                        <FiTrash2 className="text-base" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-black/70 mb-4 text-sm line-clamp-2 font-sans">
                    {workflow.description || 'No description provided'}
                  </p>
                  
                  <div className="space-y-2.5 pt-4 border-t border-[#434E78]/10">
                    {workflow.teamName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-black/60 font-sans">Team</span>
                        <span className="font-medium text-black font-sans">{workflow.teamName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center text-sm">
                          <span className="text-black/60 mr-2 font-sans">Stages:</span>
                          <span className="font-semibold text-black bg-[#434E78]/10 px-2 py-0.5 rounded-azure-sm text-xs font-sans">
                            {workflow.stages?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#434E78]/5 px-5 py-2.5 border-t border-[#434E78]/10">
                  <span className="text-sm text-[#434E78] font-medium group-hover:text-[#434E78]/80 font-sans">
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

