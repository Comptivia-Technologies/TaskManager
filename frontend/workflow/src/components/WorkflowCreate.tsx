import { useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { workflowService } from '../services/workflowService';
import { stageService } from '../services/stageService';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiChevronRight, FiX, FiEdit2, FiCheck } from 'react-icons/fi';

interface WorkflowCreateProps {
  onSuccess: (workflowId: number) => void;
  onCancel: () => void;
}

interface StageForm {
  stageName: string;
  stageOrder: number;
  teamId: number;
  tempId: number; // Temporary ID for mapping during creation
  stageType?: 'Process' | 'Escalation';
  transitionPolicy?: 'OnComplete' | 'OnTimeout' | 'Manual';
  timeoutMinutes?: number;
}


const WorkflowCreate = ({ onSuccess, onCancel }: WorkflowCreateProps) => {
  const { teams } = useTeams();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const totalSteps = 3;

  const stepLabels = ['Workflow Name', 'Description', 'Add Stages'];

  // Step 1: Workflow Name
  const [workflowName, setWorkflowName] = useState('');

  // Step 2: Description
  const [description, setDescription] = useState('');

  // Step 3: Stages with Team Assignment
  const [stages, setStages] = useState<StageForm[]>([]);
  const [editingStageIndex, setEditingStageIndex] = useState<number | null>(null);
  const [nextTempId, setNextTempId] = useState(1);
  const [stageForm, setStageForm] = useState<StageForm>({
    stageName: '',
    stageOrder: 1,
    teamId: 0,
    tempId: 0,
  });

  const [loading, setLoading] = useState(false);

  const handleAddStage = () => {
    if (stageForm.stageName.trim()) {
      if (editingStageIndex !== null) {
        const updated = [...stages];
        updated[editingStageIndex] = { ...stageForm, tempId: stages[editingStageIndex].tempId };
        setStages(updated);
        setEditingStageIndex(null);
      } else {
        const newStage = { ...stageForm, tempId: nextTempId, stageOrder: stages.length + 1 };
        setStages([...stages, newStage]);
        setNextTempId(nextTempId + 1);
      }
      setStageForm({ stageName: '', stageOrder: stages.length + 1, teamId: teams.length > 0 ? teams[0].teamId : 0, tempId: 0 });
    }
  };

  const handleEditStage = (index: number) => {
    setEditingStageIndex(index);
    setStageForm(stages[index]);
  };

  const handleDeleteStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, stageOrder: i + 1 })));
  };


  const handleSubmit = async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    if (stages.length === 0) {
      toast.error('Please add at least one stage');
      return;
    }

    if (stages.some(s => !s.teamId || s.teamId === 0)) {
      toast.error('Please assign a team to all stages');
      return;
    }

    setLoading(true);
    try {
      // Create workflow (no team required - stages have teams)
      const workflow = await workflowService.create({
        workflowName,
        description,
        // teamId is optional and omitted - workflows don't need teams since stages have teams
      });

      // Create stages sequentially to ensure they're created in order
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        await stageService.create({
          stageName: stage.stageName,
          stageOrder: stage.stageOrder,
          workflowId: workflow.workflowId,
          teamId: stage.teamId,
          stageType: stage.stageType || 'Process',
          transitionPolicy: stage.transitionPolicy || 'OnComplete',
          timeoutMinutes: stage.timeoutMinutes,
        });
      }

      // Update workflow JSON after all stages are created
      try {
        await workflowService.updateJson(workflow.workflowId);
      } catch (error) {
        // Log but don't fail - JSON will be updated automatically by backend
        console.warn('Failed to update workflow JSON:', error);
      }

      // Mark final step as completed
      if (!completedSteps.includes(3)) {
        setCompletedSteps([...completedSteps, 3]);
      }
      toast.success('Workflow created successfully!');
      onSuccess(workflow.workflowId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Workflow Name</h2>
            <div className="mb-4">
              <label className="block text-black text-sm font-semibold mb-2 font-sans">
                Workflow Name *
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full px-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                placeholder="Enter workflow name"
                required
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Description</h2>
            <div className="mb-4">
              <label className="block text-black text-sm font-semibold mb-2 font-sans">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                rows={6}
                placeholder="Enter workflow description (optional)"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Add Stages and Assign Teams</h2>
            <p className="text-black/70 mb-6 text-sm font-sans">Create stages for your workflow and assign a team to each stage.</p>
            <div className="mb-6 p-4 border border-[#434E78]/30 rounded-azure-sm bg-[#434E78]/5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-black text-sm font-semibold mb-2 font-sans">
                    Stage Name *
                  </label>
                  <input
                    type="text"
                    value={stageForm.stageName}
                    onChange={(e) =>
                      setStageForm({ ...stageForm, stageName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                    placeholder="e.g., To Do, In Progress, Done"
                  />
                </div>
                <div>
                  <label className="block text-black text-sm font-semibold mb-2 font-sans">
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
              </div>
              <div className="mb-4">
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Assign Team *
                </label>
                <select
                  value={stageForm.teamId || 0}
                  onChange={(e) =>
                    setStageForm({
                      ...stageForm,
                      teamId: parseInt(e.target.value) || 0,
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
              <button
                onClick={handleAddStage}
                className="bg-[#434E78] text-white px-4 py-2 rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
              >
                {editingStageIndex !== null ? 'Update Stage' : 'Add Stage'}
              </button>
            </div>

            {stages.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4 text-black font-sans">Added Stages</h3>
                <div className="space-y-2">
                  {stages.map((stage, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20"
                    >
                      <span className="font-medium text-black font-sans">
                        {stage.stageOrder}. {stage.stageName}
                        {stage.teamId > 0 && (
                          <span className="text-xs text-black/60 ml-2 font-sans">
                            (Team: {teams.find(t => t.teamId === stage.teamId)?.teamName})
                          </span>
                        )}
                      </span>
                      <div>
                        <button
                          onClick={() => handleEditStage(index)}
                          className="text-[#434E78] hover:text-[#434E78]/80 hover:bg-[#434E78]/10 p-1.5 rounded-azure-sm mr-2 transition-colors"
                        >
                          <FiEdit2 className="text-sm" />
                        </button>
                        <button
                          onClick={() => handleDeleteStage(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-azure-sm transition-colors"
                        >
                          <FiX className="text-sm" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const isStepCompleted = (step: number) => completedSteps.includes(step);

  const handleStepClick = (step: number) => {
    // Only allow navigation to completed steps or the current step
    if (isStepCompleted(step) || step === currentStep) {
      setCurrentStep(step);
    }
  };

  return (
    <div className="p-8 bg-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#434E78]/20">
          <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Create Workflow</h1>
          <button
            onClick={onCancel}
            className="text-black/70 hover:text-black hover:bg-[#434E78]/10 p-2 rounded-azure-sm transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        <div className="flex gap-8">
          {/* Vertical Step Indicator on Left */}
          <div className="w-16 flex-shrink-0">
            <div className="bg-white rounded-azure-sm shadow-azure-md p-4 border border-[#434E78]/20">
              <div className="relative">
                <div className="space-y-8">
                  {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
                    const isCompleted = isStepCompleted(step);
                    const isActive = step === currentStep;
                    const isPast = step < currentStep;

                    return (
                      <div key={step} className="relative flex items-center">
                        {/* Vertical line connecting to next step - passes through circle center */}
                        {/* Line starts at circle center (top-3 = 12px) and extends to next circle center */}
                        {/* Height: 12px (remaining half of circle) + 32px (space-y-8 gap) + 12px (half of next circle) = 56px */}
                        {step < totalSteps && (
                          <div className="absolute left-3 top-3 w-0.5 z-0" style={{ height: '56px' }}>
                            <div
                              className={`w-full h-full ${
                                isCompleted || isPast ? 'bg-emerald-600' : 'bg-[#434E78]/30'
                              }`}
                            />
                          </div>
                        )}

                        {/* Circle with number or checkmark - centered on line at left-3 (12px) */}
                        <div 
                          className={`relative z-10 flex-shrink-0 ${
                            (isCompleted || isActive) ? 'cursor-pointer' : 'cursor-not-allowed'
                          }`}
                          onClick={() => handleStepClick(step)}
                          title={
                            isCompleted 
                              ? `Go to ${stepLabels[step - 1]}` 
                              : isActive 
                              ? `Current step: ${stepLabels[step - 1]}`
                              : 'Complete previous steps first'
                          }
                        >
                          {isCompleted && (
                            <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center border-2 border-white hover:bg-emerald-700 transition-colors shadow-azure-sm">
                              <FiCheck className="text-white text-xs font-semibold" />
                            </div>
                          )}
                          {isActive && !isCompleted && (
                            <div className="relative">
                              {/* Pulsing ring animation */}
                              <div className="absolute inset-0 rounded-full bg-[#434E78] animate-ping opacity-75" style={{ animationDuration: '2s' }}></div>
                              {/* Main circle */}
                              <div className="relative w-6 h-6 rounded-full bg-[#434E78] flex items-center justify-center border-2 border-white hover:bg-[#434E78]/90 transition-colors shadow-azure-md">
                                <span className="text-white text-xs font-semibold z-10 relative">{step}</span>
                              </div>
                            </div>
                          )}
                          {!isActive && !isCompleted && (
                            <div className="w-6 h-6 rounded-full bg-[#434E78]/20 flex items-center justify-center border-2 border-white">
                              <span className="text-black text-xs font-semibold">{step}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-azure-sm shadow-azure-md p-8 mb-6 border border-[#434E78]/20">
              {renderStepContent()}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => {
                  const previousStep = Math.max(1, currentStep - 1);
                  // Remove current step and any steps after it from completed steps
                  setCompletedSteps(completedSteps.filter(step => step < previousStep));
                  setCurrentStep(previousStep);
                }}
                disabled={currentStep === 1}
                className="flex items-center px-5 py-2 border border-[#434E78]/30 rounded-azure-sm hover:bg-[#434E78]/5 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium text-sm transition-colors font-sans"
              >
                <FiChevronLeft className="mr-2" />
                Back
              </button>
          {currentStep < totalSteps ? (
            <button
              onClick={() => {
                // Validate step 1 - ensure workflow name is entered
                if (currentStep === 1 && !workflowName.trim()) {
                  toast.error('Please enter a workflow name');
                  return;
                }
                // Validate step 3 - ensure all stages have teams assigned
                if (currentStep === 3 && stages.some(s => !s.teamId || s.teamId === 0)) {
                  toast.error('Please assign a team to all stages before proceeding');
                  return;
                }
                // Mark current step as completed
                if (!completedSteps.includes(currentStep)) {
                  setCompletedSteps([...completedSteps, currentStep]);
                }
                setCurrentStep(Math.min(totalSteps, currentStep + 1));
              }}
              className="flex items-center px-5 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 font-medium text-sm shadow-azure-sm transition-colors font-sans"
            >
              Next
              <FiChevronRight className="ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center px-5 py-2 bg-emerald-600 text-white rounded-azure-sm hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm shadow-azure-sm transition-colors font-sans"
            >
              {loading ? 'Creating...' : 'Create Workflow'}
            </button>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowCreate;

