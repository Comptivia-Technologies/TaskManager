import { useState, useEffect } from 'react';
import { useTeams } from '../hooks/useTeams';
import { workflowService } from '../services/workflowService';
import { stageService } from '../services/stageService';
import { Workflow, WorkflowUpdate } from '../types';
import { toast } from 'react-toastify';
import { FiX, FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';

interface WorkflowEditProps {
  workflow: Workflow;
  onSuccess: () => void;
  onCancel: () => void;
}

interface StageForm {
  stageId?: string; // Existing stage has ID, new stage doesn't
  tempId?: number; // Temporary ID for new stages (this is used to keep track of the order of the stages when they are added)
  stageName: string;
  stageOrder: number;
  teamId: string;
  teamName?: string;
  stageType?: 'Process' | 'Escalation';
  transitionPolicy?: 'OnComplete' | 'OnTimeout' | 'Manual';
  timeoutMinutes?: number;
}

const WorkflowEdit = ({ workflow, onSuccess, onCancel }: WorkflowEditProps) => {
  const { teams } = useTeams();
  const [workflowName, setWorkflowName] = useState(workflow.workflowName);
  const [description, setDescription] = useState(workflow.description || '');
  const [stages, setStages] = useState<StageForm[]>([]);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);
  const [nextTempId, setNextTempId] = useState(1);
  const [stageForm, setStageForm] = useState<StageForm>({
    stageName: '',
    stageOrder: 1,
    teamId: teams.length > 0 ? teams[0].teamId : '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWorkflowName(workflow.workflowName);
    setDescription(workflow.description || '');
    // Convert existing stages to StageForm format
    const existingStages: StageForm[] = (workflow.stages || []).map(stage => ({
      stageId: stage.stageId,
      stageName: stage.stageName,
      stageOrder: stage.stageOrder,
      teamId: stage.teamId,
      teamName: stage.teamName,
      stageType: stage.stageType || 'Process',
      transitionPolicy: stage.transitionPolicy || 'OnComplete',
      timeoutMinutes: stage.timeoutMinutes,
    }));
    setStages(existingStages);
    setNextTempId(1);
  }, [workflow, teams]);

  const handleAddStage = () => {
    if (!stageForm.stageName.trim()) {
      toast.error('Please enter a stage name');
      return;
    }

    if (!stageForm.teamId) {
      toast.error('Please select a team for the stage');
      return;
    }

    if (editingStageIndex !== null) {
      // Update existing stage
      const updated = [...stages];
      updated[editingStageIndex] = { ...stageForm };
      setStages(updated);
      setEditingStageIndex(null);
    } else {
      // Add new stage
      const newStage: StageForm = {
        ...stageForm,
        tempId: nextTempId,
        stageOrder: stages.length + 1,
      };
      setStages([...stages, newStage]);
      setNextTempId(nextTempId + 1);
    }
    
    // Reset form
    setStageForm({
      stageName: '',
      stageOrder: stages.length + 1,
      teamId: teams.length > 0 ? teams[0].teamId : '',
    });
  };

  const handleEditStage = (index: number) => {
    setEditingStageIndex(index);
    setStageForm(stages[index]);
  };

  const handleDeleteStage = (index: number) => {
    const updatedStages = stages.filter((_, i) => i !== index).map((s, i) => ({
      ...s,
      stageOrder: i + 1,
    }));
    setStages(updatedStages);
    if (editingStageIndex === index) {
      setEditingStageIndex(null);
      setStageForm({
        stageName: '',
        stageOrder: updatedStages.length + 1,
        teamId: teams.length > 0 ? teams[0].teamId : '',
      });
    } else if (editingStageIndex !== null && editingStageIndex > index) {
      setEditingStageIndex(editingStageIndex - 1);
    }
  };

  const handleCancelStageEdit = () => {
    setEditingStageIndex(null);
    setStageForm({
      stageName: '',
      stageOrder: stages.length + 1,
      teamId: teams.length > 0 ? teams[0].teamId : '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    if (stages.length === 0) {
      toast.error('Please add at least one stage');
      return;
    }

    if (stages.some(s => !s.teamId)) {
      toast.error('Please assign a team to all stages');
      return;
    }

    setLoading(true);
    try {
      // Update workflow name and description
      const updateData: WorkflowUpdate = {
        workflowName: workflowName.trim(),
        description: description.trim() || undefined,
      };
      
      await workflowService.update(workflow.workflowId, updateData);
      
      // Get original stage IDs
      const originalStageIds = new Set((workflow.stages || []).map(s => s.stageId));
      const currentStageIds = new Set(stages.filter(s => s.stageId).map(s => s.stageId!));
      
      // Delete stages that were removed
      const stagesToDelete = Array.from(originalStageIds).filter(id => !currentStageIds.has(id));
      for (const stageId of stagesToDelete) {
        await stageService.delete(stageId);
      }
      
      // Update existing stages and create new ones
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const stageOrder = i + 1;
        
        if (stage.stageId) {
          // Update existing stage
          const originalStage = workflow.stages?.find(s => s.stageId === stage.stageId);
          if (originalStage) {
            const hasChanges = 
              originalStage.stageName !== stage.stageName ||
              originalStage.stageOrder !== stageOrder ||
              originalStage.teamId !== stage.teamId;
            
            if (hasChanges) {
              await stageService.update(stage.stageId, {
                stageName: stage.stageName,
                stageOrder: stageOrder,
                teamId: stage.teamId,
                stageType: stage.stageType || 'Process',
                transitionPolicy: stage.transitionPolicy || 'OnComplete',
                timeoutMinutes: stage.timeoutMinutes,
              });
            }
          }
        } else {
          // Create new stage
          await stageService.create({
            stageName: stage.stageName,
            stageOrder: stageOrder,
            workflowId: workflow.workflowId,
            teamId: stage.teamId,
            stageType: stage.stageType || 'Process',
            transitionPolicy: stage.transitionPolicy || 'OnComplete',
            timeoutMinutes: stage.timeoutMinutes,
          });
        }
      }
      
      // Update workflow JSON
      try {
        await workflowService.updateJson(workflow.workflowId);
      } catch (error) {
        console.warn('Failed to update workflow JSON:', error);
      }
      
      toast.success('Workflow updated successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#434E78]/20">
          <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Edit Workflow</h1>
          <button
            onClick={onCancel}
            className="text-black/70 hover:text-black hover:bg-[#434E78]/10 p-2 rounded-azure-sm transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        <div className="bg-white rounded-azure-sm shadow-azure-md p-8 border border-[#434E78]/20">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-black text-sm font-semibold mb-2 font-sans">
                Workflow Name *
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full px-4 py-3 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                placeholder="Enter workflow name"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-black text-sm font-semibold mb-2 font-sans">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                rows={6}
                placeholder="Enter workflow description (optional)"
              />
            </div>

            <div className="mb-6">
              <label className="block text-black text-sm font-semibold mb-3 font-sans">
                Stages
              </label>
              
              {/* Add/Edit Stage Form */}
              <div className="mb-4 p-4 border border-[#434E78]/30 rounded-azure-sm bg-[#434E78]/5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-black text-xs font-semibold mb-1 font-sans">
                      Stage Name *
                    </label>
                    <input
                      type="text"
                      value={stageForm.stageName}
                      onChange={(e) =>
                        setStageForm({ ...stageForm, stageName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                      placeholder="e.g., To Do, In Progress"
                    />
                  </div>
                  <div>
                    <label className="block text-black text-xs font-semibold mb-1 font-sans">
                      Order *
                    </label>
                    <input
                      type="number"
                      value={stageForm.stageOrder}
                      onChange={(e) =>
                        setStageForm({
                          ...stageForm,
                          stageOrder: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-black text-xs font-semibold mb-1 font-sans">
                      Team *
                    </label>
                    <select
                    value={stageForm.teamId || ''}
                    onChange={(e) =>
                      setStageForm({
                        ...stageForm,
                        teamId: e.target.value || '',
                      })
                    }
                    className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                      required
                    >
                      <option value={0}>Select Team</option>
                      {teams.map((team) => (
                        <option key={team.teamId} value={team.teamId}>
                          {team.teamName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                  >
                    {editingStageIndex !== null ? (
                      <>
                        <FiEdit2 className="inline mr-1" />
                        Update Stage
                      </>
                    ) : (
                      <>
                        <FiPlus className="inline mr-1" />
                        Add Stage
                      </>
                    )}
                  </button>
                  {editingStageIndex !== null && (
                    <button
                      type="button"
                      onClick={handleCancelStageEdit}
                      className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Existing Stages List */}
              {stages.length > 0 && (
                <div className="space-y-2">
                  {stages
                    .sort((a, b) => a.stageOrder - b.stageOrder)
                    .map((stage, index) => {
                      const actualIndex = stages.findIndex(
                        s => (stage.stageId && s.stageId === stage.stageId) || 
                             (stage.tempId && s.tempId === stage.tempId)
                      );
                      return (
                        <div
                          key={stage.stageId || stage.tempId}
                          className="flex items-center gap-3 p-3 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-black font-sans">
                              {stage.stageOrder}. {stage.stageName}
                            </div>
                            <div className="text-xs text-black/60 font-sans">
                              Team: {teams.find(t => t.teamId === stage.teamId)?.teamName || 'Not assigned'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditStage(actualIndex)}
                              className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-1.5 rounded-azure-sm transition-colors"
                              title="Edit stage"
                            >
                              <FiEdit2 className="text-base" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStage(actualIndex)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-azure-sm transition-colors"
                              title="Delete stage"
                            >
                              <FiTrash2 className="text-base" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 text-black font-medium text-sm transition-colors font-sans"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 disabled:opacity-50 font-medium text-sm shadow-azure-sm transition-colors font-sans"
              >
                {loading ? 'Updating...' : 'Update Workflow'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEdit;

