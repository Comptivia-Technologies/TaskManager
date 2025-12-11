import { useState, useEffect } from 'react';
import { useWorkflows } from '../hooks/useWorkflows';
import { slaService } from '../services/slaService';
import { PriorityLevel } from '../types';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiChevronRight, FiX, FiCheck, FiClock } from 'react-icons/fi';

interface SLAConfigureProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialWorkflowId?: number;
}

const SLAConfigure = ({ onSuccess, onCancel, initialWorkflowId }: SLAConfigureProps) => {
  const { workflows } = useWorkflows();
  const [currentStep, setCurrentStep] = useState(initialWorkflowId ? 2 : 1);
  const [completedSteps, setCompletedSteps] = useState<number[]>(initialWorkflowId ? [1] : []);
  const totalSteps = 2;

  const stepLabels = ['Select Workflow', 'Configure Priority Levels'];

  // Step 1: Select Workflow
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(initialWorkflowId || null);

  // Step 2: Set Response Times for All Priority Levels
  const priorityLevels: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];
  const [priorityConfigs, setPriorityConfigs] = useState<{
    [key in PriorityLevel]: { responseTime: number; timeUnit: 'minutes' | 'hours' | 'days' };
  }>({
    Critical: { responseTime: 0, timeUnit: 'minutes' },
    High: { responseTime: 0, timeUnit: 'minutes' },
    Medium: { responseTime: 0, timeUnit: 'minutes' },
    Low: { responseTime: 0, timeUnit: 'minutes' },
  });

  const [loading, setLoading] = useState(false);
  const [existingConfig, setExistingConfig] = useState<any>(null);

  // Fetch existing SLA config when workflow is selected
  useEffect(() => {
    const fetchExistingConfig = async () => {
      if (selectedWorkflowId) {
        try {
          const config = await slaService.getByWorkflowId(selectedWorkflowId);
          setExistingConfig(config);
          
          // Populate priority configs with existing values
          if (config && config.priorityLevels) {
            const newConfigs: typeof priorityConfigs = {
              Critical: { responseTime: 0, timeUnit: 'minutes' },
              High: { responseTime: 0, timeUnit: 'minutes' },
              Medium: { responseTime: 0, timeUnit: 'minutes' },
              Low: { responseTime: 0, timeUnit: 'minutes' },
            };
            
            const levels: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];
            levels.forEach((priority) => {
              const existingTime = config.priorityLevels[priority]?.responseTime || 0;
              if (existingTime > 0) {
                // Convert minutes to appropriate unit for display
                if (existingTime < 60) {
                  newConfigs[priority] = { responseTime: existingTime, timeUnit: 'minutes' };
                } else if (existingTime < 1440) {
                  newConfigs[priority] = { responseTime: Math.floor(existingTime / 60), timeUnit: 'hours' };
                } else {
                  newConfigs[priority] = { responseTime: Math.floor(existingTime / 1440), timeUnit: 'days' };
                }
              }
            });
            
            setPriorityConfigs(newConfigs);
          }
        } catch (error) {
          // No existing config
          setExistingConfig(null);
        }
      }
    };
    fetchExistingConfig();
  }, [selectedWorkflowId]);

  const priorityColors: { [key in PriorityLevel]: string } = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const convertToMinutes = (value: number, unit: 'minutes' | 'hours' | 'days'): number => {
    switch (unit) {
      case 'minutes':
        return value;
      case 'hours':
        return value * 60;
      case 'days':
        return value * 60 * 24;
      default:
        return value;
    }
  };

  const handleSubmit = async () => {
    if (!selectedWorkflowId) {
      toast.error('Please select a workflow');
      return;
    }

    // Validate that at least one priority has a response time
    const hasAnyTime = priorityLevels.some(
      (priority) => priorityConfigs[priority].responseTime > 0
    );

    if (!hasAnyTime) {
      toast.error('Please set response time for at least one priority level');
      return;
    }

    setLoading(true);
    try {
      // Convert all priority configs to minutes
      const currentConfig: {
        [key in PriorityLevel]: { responseTime: number };
      } = {
        Critical: { responseTime: 0 },
        High: { responseTime: 0 },
        Medium: { responseTime: 0 },
        Low: { responseTime: 0 },
      };

      priorityLevels.forEach((priority) => {
        const config = priorityConfigs[priority];
        if (config.responseTime > 0) {
          currentConfig[priority] = {
            responseTime: convertToMinutes(config.responseTime, config.timeUnit),
          };
        }
      });

      if (existingConfig) {
        // Update existing configuration
        await slaService.update(selectedWorkflowId, { priorityLevels: currentConfig });
        toast.success('SLA configuration updated successfully');
      } else {
        // Create new configuration
        await slaService.create({
          workflowId: selectedWorkflowId,
          priorityLevels: currentConfig,
        });
        toast.success('SLA configuration created successfully');
      }

      // Mark final step as completed
      if (!completedSteps.includes(2)) {
        setCompletedSteps([...completedSteps, 2]);
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save SLA configuration');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Select Workflow</h2>
            <p className="text-black/70 mb-6 text-sm font-sans">
              Choose the workflow you want to configure SLA settings for.
            </p>
            {workflows.length === 0 ? (
              <div className="text-center py-8 text-black/70 font-sans">
                <p>No workflows available. Please create a workflow first.</p>
              </div>
            ) : (
              <div>
                <label className="block text-black text-sm font-semibold mb-2 font-sans">
                  Workflow *
                </label>
                <select
                  value={selectedWorkflowId || ''}
                  onChange={(e) => setSelectedWorkflowId(parseInt(e.target.value) || null)}
                  className="w-full px-4 py-3 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-black text-sm font-sans"
                  required
                >
                  <option value="">Select a workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow.workflowId} value={workflow.workflowId}>
                      {workflow.workflowName}
                      {workflow.teamName ? ` (${workflow.teamName})` : ''}
                    </option>
                  ))}
                </select>
                {selectedWorkflowId && (
                  <div className="mt-4 p-4 bg-[#434E78]/5 border border-[#434E78]/20 rounded-azure-sm">
                    {(() => {
                      const selectedWorkflow = workflows.find(w => w.workflowId === selectedWorkflowId);
                      return selectedWorkflow ? (
                        <div>
                          <p className="text-sm font-semibold text-black mb-1 font-sans">
                            {selectedWorkflow.workflowName}
                          </p>
                          {selectedWorkflow.description && (
                            <p className="text-sm text-black/70 mb-2 font-sans">
                              {selectedWorkflow.description}
                            </p>
                          )}
                          {selectedWorkflow.teamName && (
                            <p className="text-xs text-black/60 font-sans">
                              Team: {selectedWorkflow.teamName}
                            </p>
                          )}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-black font-sans">Configure Priority Levels</h2>
            <p className="text-black/70 mb-6 text-sm font-sans">
              Set response times for all priority levels. You must configure at least one priority level.
            </p>
            {selectedWorkflowId && (
              <div className="mb-6 p-4 bg-[#434E78]/5 border border-[#434E78]/20 rounded-azure-sm">
                <p className="text-sm text-black/70 font-sans">
                  <strong>Workflow:</strong> {workflows.find(w => w.workflowId === selectedWorkflowId)?.workflowName}
                </p>
              </div>
            )}
            {existingConfig && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-azure-sm">
                <p className="text-sm text-blue-800 font-sans">
                  <strong>Note:</strong> This workflow already has SLA configurations. You can update all priority levels below.
                </p>
              </div>
            )}
            <div className="space-y-4">
              {priorityLevels.map((priority) => {
                const config = priorityConfigs[priority];
                const existingTime = existingConfig?.priorityLevels?.[priority]?.responseTime || 0;
                const totalMinutes = convertToMinutes(config.responseTime, config.timeUnit);
                
                return (
                  <div
                    key={priority}
                    className={`p-4 border-2 rounded-azure-sm ${priorityColors[priority]}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm">{priority} Priority</h3>
                      {existingTime > 0 && (
                        <span className="text-xs opacity-75">
                          Current: {formatTime(existingTime)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold mb-1 opacity-75">
                          Response Time
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={config.responseTime || ''}
                          onChange={(e) => {
                            setPriorityConfigs({
                              ...priorityConfigs,
                              [priority]: {
                                ...config,
                                responseTime: parseInt(e.target.value) || 0,
                              },
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-transparent bg-white text-gray-900 text-sm font-sans"
                          placeholder="Enter time"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1 opacity-75">
                          Unit
                        </label>
                        <select
                          value={config.timeUnit}
                          onChange={(e) => {
                            setPriorityConfigs({
                              ...priorityConfigs,
                              [priority]: {
                                ...config,
                                timeUnit: e.target.value as 'minutes' | 'hours' | 'days',
                              },
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-transparent bg-white text-gray-900 text-sm font-sans"
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>
                    {totalMinutes > 0 && (
                      <div className="mt-2 text-xs opacity-75">
                        Total: <strong>{formatTime(totalMinutes)}</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const formatTime = (minutes: number): string => {
    if (minutes === 0) return '0 minutes';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) return `${days} day${days !== 1 ? 's' : ''}`;
      return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  const isStepCompleted = (step: number) => completedSteps.includes(step);

  const handleStepClick = (step: number) => {
    if (isStepCompleted(step) || step === currentStep) {
      setCurrentStep(step);
    }
  };

  return (
    <div className="p-8 bg-white font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#434E78]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#434E78]/10 rounded-azure-sm flex items-center justify-center">
              <FiClock className="text-xl text-[#434E78]" />
            </div>
            <h1 className="text-3xl font-semibold text-black font-sans tracking-tight">Configure SLA</h1>
          </div>
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
                        {step < totalSteps && (
                          <div className="absolute left-3 top-3 w-0.5 z-0" style={{ height: '56px' }}>
                            <div
                              className={`w-full h-full ${
                                isCompleted || isPast ? 'bg-emerald-600' : 'bg-[#434E78]/30'
                              }`}
                            />
                          </div>
                        )}

                        <div
                          className={`relative z-10 flex-shrink-0 ${
                            isCompleted || isActive ? 'cursor-pointer' : 'cursor-not-allowed'
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
                              <div
                                className="absolute inset-0 rounded-full bg-[#434E78] animate-ping opacity-75"
                                style={{ animationDuration: '2s' }}
                              ></div>
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
                  setCompletedSteps(completedSteps.filter((step) => step < previousStep));
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
                    // Validate step 1
                    if (currentStep === 1 && !selectedWorkflowId) {
                      toast.error('Please select a workflow');
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
                  disabled={loading || !priorityLevels.some(p => priorityConfigs[p].responseTime > 0)}
                  className="flex items-center px-5 py-2 bg-emerald-600 text-white rounded-azure-sm hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm shadow-azure-sm transition-colors font-sans"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SLAConfigure;

