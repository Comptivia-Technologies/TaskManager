import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workflowService } from '../services/workflowService';
import { Workflow } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import WorkflowStagesView from '../components/WorkflowStagesView';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiCode, FiEye } from 'react-icons/fi';
import { formatDateOnlyIST } from '../utils/dateUtils';

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
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="max-w-full">
        {/* Header Section */}
        <div className="bg-white rounded-azure-sm shadow-azure-sm p-6 mb-4 border border-[#434E78]/20">
          <button
            onClick={() => navigate('/workflows')}
            className="mb-4 flex items-center text-[#434E78] hover:text-[#434E78]/80 font-medium transition-colors font-sans text-sm"
          >
            <FiArrowLeft className="mr-2" />
            Back to Workflows
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-black mb-2 font-sans tracking-tight">{workflow.workflowName}</h1>
              <p className="text-black/70 text-base mb-4 font-sans">
                {workflow.description || 'No description provided'}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm">
                  {workflow.teamName && (
                    <div className="flex items-center">
                      <span className="text-black/60 mr-2 font-sans">Workflow Team:</span>
                      <span className="font-semibold text-black bg-[#434E78]/10 px-2.5 py-1 rounded-azure-sm text-xs font-sans">
                        {workflow.teamName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="text-black/60 mr-2 font-sans">Stages:</span>
                    <span className="font-semibold text-black bg-[#434E78]/10 px-2.5 py-1 rounded-azure-sm text-xs font-sans">
                      {workflow.stages?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-black/60 mr-2 font-sans">Created:</span>
                    <span className="font-semibold text-black font-sans">
                      {formatDateOnlyIST(workflow.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('ui')}
                    className={`flex items-center px-3 py-1.5 rounded-azure-sm transition-colors text-sm font-medium ${
                      viewMode === 'ui'
                        ? 'bg-[#434E78] text-white shadow-azure-sm'
                        : 'bg-[#434E78]/10 text-[#434E78] hover:bg-[#434E78]/20'
                    }`}
                  >
                    <FiEye className="mr-1.5 text-sm" />
                    UI View
                  </button>
                  <button
                    onClick={() => setViewMode('json')}
                    className={`flex items-center px-3 py-1.5 rounded-azure-sm transition-colors text-sm font-medium ${
                      viewMode === 'json'
                        ? 'bg-[#434E78] text-white shadow-azure-sm'
                        : 'bg-[#434E78]/10 text-[#434E78] hover:bg-[#434E78]/20'
                    }`}
                  >
                    <FiCode className="mr-1.5 text-sm" />
                    JSON View
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-azure-sm shadow-azure-sm p-4 border border-[#434E78]/20">
          {viewMode === 'ui' ? (
            <WorkflowStagesView workflow={workflow} />
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between pb-4 border-b border-[#434E78]/20">
                <div>
                  <h2 className="text-lg font-semibold text-black font-sans">JSON View</h2>
                  <p className="text-sm text-black/70 mt-1 font-sans">
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
                  className="px-3 py-1.5 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 transition-colors flex items-center gap-2 text-sm font-medium shadow-azure-sm"
                >
                  <FiCode className="text-sm" />
                  Copy JSON
                </button>
              </div>
              <div className="bg-[#434E78]/5 p-4 rounded-azure-sm overflow-auto max-h-[600px] border border-[#434E78]/20">
                <pre className="text-sm text-black whitespace-pre-wrap font-mono">
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

