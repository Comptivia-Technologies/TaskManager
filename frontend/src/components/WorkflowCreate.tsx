import { useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { workflowService } from '../services/workflowService';
import { stageService } from '../services/stageService';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiChevronRight, FiX, FiEdit2 } from 'react-icons/fi';

interface WorkflowCreateProps {
  onSuccess: (workflowId: number) => void;
  onCancel: () => void;
}

interface StageForm {
  stageName: string;
  stageOrder: number;
  teamId: number;
  tempId: number; // Temporary ID for mapping during creation
}


const WorkflowCreate = ({ onSuccess, onCancel }: WorkflowCreateProps) => {
  const { teams } = useTeams();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

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
        });
      }

      // Update workflow JSON after all stages are created
      try {
        await workflowService.updateJson(workflow.workflowId);
      } catch (error) {
        // Log but don't fail - JSON will be updated automatically by backend
        console.warn('Failed to update workflow JSON:', error);
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
            <h2 className="text-2xl font-bold mb-4">Step 1: Workflow Name</h2>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Workflow Name *
              </label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter workflow name"
                required
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 2: Description</h2>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={6}
                placeholder="Enter workflow description (optional)"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Step 3: Add Stages and Assign Teams</h2>
            <p className="text-gray-600 mb-6">Create stages for your workflow and assign a team to each stage.</p>
            <div className="mb-6 p-4 border border-gray-300 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Stage Name *
                  </label>
                  <input
                    type="text"
                    value={stageForm.stageName}
                    onChange={(e) =>
                      setStageForm({ ...stageForm, stageName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., To Do, In Progress, Done"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                {editingStageIndex !== null ? 'Update Stage' : 'Add Stage'}
              </button>
            </div>

            {stages.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold mb-4">Added Stages</h3>
                <div className="space-y-2">
                  {stages.map((stage, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="font-medium">
                        {stage.stageOrder}. {stage.stageName}
                        {stage.teamId > 0 && (
                          <span className="text-xs text-gray-500 ml-2">
                            (Team: {teams.find(t => t.teamId === stage.teamId)?.teamName})
                          </span>
                        )}
                      </span>
                      <div>
                        <button
                          onClick={() => handleEditStage(index)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDeleteStage(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FiX />
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

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Create Workflow</h1>
            <button
              onClick={onCancel}
              className="text-gray-600 hover:text-gray-800"
            >
              <FiX className="text-2xl" />
            </button>
          </div>
          <div className="flex items-center justify-between mb-8">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    step === currentStep
                      ? 'bg-blue-500 text-white'
                      : step < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                {step < totalSteps && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          {renderStepContent()}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiChevronLeft className="mr-2" />
            Back
          </button>
          {currentStep < totalSteps ? (
            <button
              onClick={() => {
                // Validate step 3 - ensure all stages have teams assigned
                if (currentStep === 3 && stages.some(s => !s.teamId || s.teamId === 0)) {
                  toast.error('Please assign a team to all stages before proceeding');
                  return;
                }
                setCurrentStep(Math.min(totalSteps, currentStep + 1));
              }}
              className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Next
              <FiChevronRight className="ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Workflow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCreate;

