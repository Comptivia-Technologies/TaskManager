import { useState, useEffect } from 'react';
import { useWorkflows } from '../hooks/useWorkflows';
import { slaService } from '../services/slaService';
import { toast } from 'react-toastify';
import { FiCheck, FiChevronLeft, FiChevronRight, FiInfo, FiPlus, FiX } from 'react-icons/fi';
import { apiErrorMessage } from '../utils/apiError';
import { inputClass } from '../utils/formStyles';
import { priorityTone } from '../utils/status';
import Button, { IconButton } from './Button';
import Field from './Field';
import PageHeader from './PageHeader';
import WizardStepper from './WizardStepper';

interface SLAConfigureProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialWorkflowId?: string;
  /**
   * Inside another flow (the workflow wizard) only the priorities editor and its
   * save button render — no page header or step rail of its own.
   */
  embedded?: boolean;
}

type TimeUnit = 'minutes' | 'hours' | 'days';

interface PriorityConfig {
  id: string;
  name: string;
  responseTime: number;
  timeUnit: TimeUnit;
}

const DEFAULT_PRIORITIES: PriorityConfig[] = [
  { id: 'critical', name: 'Critical', responseTime: 0, timeUnit: 'minutes' },
  { id: 'high', name: 'High', responseTime: 0, timeUnit: 'minutes' },
  { id: 'medium', name: 'Medium', responseTime: 0, timeUnit: 'minutes' },
  { id: 'low', name: 'Low', responseTime: 0, timeUnit: 'minutes' },
];

const TONE_DOT: Record<string, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning-strong',
  info: 'bg-info',
  neutral: 'bg-ink-subtle',
  primary: 'bg-primary',
  success: 'bg-success-strong',
};

const convertToMinutes = (value: number, unit: TimeUnit): number => {
  switch (unit) {
    case 'hours':
      return value * 60;
    case 'days':
      return value * 60 * 24;
    default:
      return value;
  }
};

export const formatTime = (minutes: number): string => {
  if (minutes === 0) return '0 minutes';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0 && hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days} day${days !== 1 ? 's' : ''}`;
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
};

const SLAConfigure = ({ onSuccess, onCancel, initialWorkflowId, embedded = false }: SLAConfigureProps) => {
  const { workflows } = useWorkflows();
  const [currentStep, setCurrentStep] = useState(initialWorkflowId ? 2 : 1);
  const [completedSteps, setCompletedSteps] = useState<number[]>(initialWorkflowId ? [1] : []);
  const totalSteps = 2;

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(initialWorkflowId || null);
  const [priorities, setPriorities] = useState<PriorityConfig[]>(DEFAULT_PRIORITIES);
  const [newPriorityName, setNewPriorityName] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingConfig, setExistingConfig] = useState<any>(null);

  // Fetch existing SLA config when workflow is selected
  useEffect(() => {
    const fetchExistingConfig = async () => {
      if (!selectedWorkflowId) {
        setPriorities(DEFAULT_PRIORITIES);
        return;
      }
      try {
        const config = await slaService.getByWorkflowId(selectedWorkflowId);
        setExistingConfig(config);

        // Load ALL priorities, even with 0 response time
        if (config && config.priorityLevels) {
          const loadedPriorities: PriorityConfig[] = Object.entries(config.priorityLevels).map(
            ([name, value]: [string, { responseTime: number }], index) => {
              const existingTime = value?.responseTime || 0;
              let displayTime = 0;
              let unit: TimeUnit = 'minutes';
              if (existingTime > 0) {
                if (existingTime < 60) {
                  displayTime = existingTime;
                } else if (existingTime < 1440) {
                  displayTime = Math.floor(existingTime / 60);
                  unit = 'hours';
                } else {
                  displayTime = Math.floor(existingTime / 1440);
                  unit = 'days';
                }
              }
              return {
                id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
                name,
                responseTime: displayTime,
                timeUnit: unit,
              };
            }
          );
          setPriorities(loadedPriorities);
        } else {
          setPriorities(DEFAULT_PRIORITIES);
        }
      } catch (error) {
        setExistingConfig(null);
        setPriorities(DEFAULT_PRIORITIES);
      }
    };
    fetchExistingConfig();
  }, [selectedWorkflowId]);

  const updatePriority = (id: string, patch: Partial<PriorityConfig>) =>
    setPriorities((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPriority = () => {
    const trimmed = newPriorityName.trim();
    if (!trimmed) return;
    if (priorities.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('A priority with this name already exists');
      return;
    }
    setPriorities([
      ...priorities,
      { id: `${trimmed.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`, name: trimmed, responseTime: 0, timeUnit: 'minutes' },
    ]);
    setNewPriorityName('');
  };

  const handleSubmit = async () => {
    if (!selectedWorkflowId) {
      toast.error('Please select a workflow');
      return;
    }

    if (!priorities.some((p) => p.responseTime > 0)) {
      toast.error('Please set response time for at least one priority level');
      return;
    }

    setLoading(true);
    try {
      // Save ALL priorities, not just ones with responseTime > 0
      const currentConfig: { [key: string]: { responseTime: number } } = {};
      priorities.forEach((priority) => {
        if (priority.name.trim()) {
          currentConfig[priority.name.trim()] = {
            responseTime: convertToMinutes(priority.responseTime, priority.timeUnit),
          };
        }
      });

      if (existingConfig) {
        await slaService.update(selectedWorkflowId, { priorityLevels: currentConfig });
        toast.success('SLA configuration updated successfully');
      } else {
        await slaService.create({ workflowId: selectedWorkflowId, priorityLevels: currentConfig });
        toast.success('SLA configuration created successfully');
      }

      if (!completedSteps.includes(2)) {
        setCompletedSteps([...completedSteps, 2]);
      }
      onSuccess();
    } catch (error: any) {
      toast.error(apiErrorMessage(error, 'Failed to save SLA configuration'));
    } finally {
      setLoading(false);
    }
  };

  const canSave = priorities.some((p) => p.name.trim() && p.responseTime > 0);
  const selectedWorkflow = workflows.find((w) => w.workflowId === selectedWorkflowId);

  const prioritiesEditor = (
    <div>
      {existingConfig && (
        <div className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-info-subtle border border-info-border rounded-card text-body text-info">
          <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" />
          This workflow already has response times. Changes here replace them.
        </div>
      )}

      <div className="rounded-card border border-line overflow-hidden">
        <div className="hidden sm:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_2.5rem] gap-3 px-4 h-9 items-center bg-surface-muted border-b border-line">
          <span className="eyebrow">Priority</span>
          <span className="eyebrow">Respond within</span>
          <span className="eyebrow">Total</span>
          <span />
        </div>
        <ul className="divide-y divide-line-subtle">
          {priorities.map((priority) => {
            const totalMinutes = convertToMinutes(priority.responseTime, priority.timeUnit);
            return (
              <li key={priority.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_2.5rem] gap-3 px-4 py-3 items-center">
                <div className="relative">
                  <span aria-hidden="true" className={`absolute left-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ${TONE_DOT[priorityTone(priority.name)]}`} />
                  <input
                    type="text"
                    aria-label="Priority name"
                    value={priority.name}
                    onChange={(e) => updatePriority(priority.id, { name: e.target.value })}
                    className={`${inputClass} pl-7 font-medium`}
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    aria-label={`${priority.name} response time`}
                    value={priority.responseTime || ''}
                    onChange={(e) => updatePriority(priority.id, { responseTime: parseInt(e.target.value) || 0 })}
                    className={`${inputClass} font-mono tabular`}
                    placeholder="0"
                  />
                  <select
                    aria-label={`${priority.name} time unit`}
                    value={priority.timeUnit}
                    onChange={(e) => updatePriority(priority.id, { timeUnit: e.target.value as TimeUnit })}
                    className={`${inputClass} w-32 shrink-0`}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                <span className={`text-meta ${totalMinutes > 0 ? 'text-ink' : 'text-ink-subtle'}`}>
                  {totalMinutes > 0 ? formatTime(totalMinutes) : 'Not set — due immediately'}
                </span>
                <div className="flex justify-end">
                  {priorities.length > 1 && (
                    <IconButton
                      size="sm"
                      tone="danger"
                      label={`Remove ${priority.name || 'priority'}`}
                      icon={<FiX />}
                      onClick={() => setPriorities((prev) => prev.filter((p) => p.id !== priority.id))}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <form
          className="flex flex-col sm:flex-row gap-2 px-4 py-3 border-t border-line bg-surface-muted"
          onSubmit={(e) => {
            e.preventDefault();
            addPriority();
          }}
        >
          <label htmlFor="new-priority" className="sr-only">New priority name</label>
          <input
            id="new-priority"
            type="text"
            value={newPriorityName}
            onChange={(e) => setNewPriorityName(e.target.value)}
            placeholder="Add a priority level, e.g. Very Critical"
            className={`${inputClass} sm:max-w-sm`}
          />
          <Button type="submit" size="md" icon={<FiPlus />} disabled={!newPriorityName.trim()}>
            Add Priority
          </Button>
        </form>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div>
        {prioritiesEditor}
        <div className="mt-4 flex justify-end">
          <Button variant="primary" loading={loading} disabled={!canSave} onClick={handleSubmit} icon={<FiCheck />}>
            {loading ? 'Saving…' : 'Save Configuration'}
          </Button>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="max-w-xl">
          <h2 className="text-title font-semibold text-ink">Select Workflow</h2>
          <p className="mt-1 mb-6 text-body text-ink-muted">Response times are set per workflow.</p>
          {workflows.length === 0 ? (
            <p className="py-6 text-body text-ink-muted">No workflows available. Create a workflow first.</p>
          ) : (
            <>
              <Field htmlFor="sla-workflow" label="Workflow" required>
                <select
                  id="sla-workflow"
                  value={selectedWorkflowId || ''}
                  onChange={(e) => setSelectedWorkflowId(e.target.value || null)}
                  className={inputClass}
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
              </Field>
              {selectedWorkflow && (
                <div className="mt-4 rounded-card bg-surface-muted border border-line px-4 py-3">
                  <p className="text-body font-medium text-ink">{selectedWorkflow.workflowName}</p>
                  {selectedWorkflow.description && <p className="text-meta text-ink-subtle mt-0.5">{selectedWorkflow.description}</p>}
                  <p className="text-meta text-ink-subtle mt-1">{selectedWorkflow.stages?.length ?? 0} stages</p>
                </div>
              )}
            </>
          )}
        </div>
      );
    }
    return (
      <div>
        <h2 className="text-title font-semibold text-ink">Configure Priorities</h2>
        <p className="mt-1 mb-6 text-body text-ink-muted">
          How quickly each priority must be picked up
          {selectedWorkflow ? <> on <span className="font-medium text-ink">{selectedWorkflow.workflowName}</span></> : null}. Set at
          least one — a workflow with none never assigns its enquiries, and a priority left at zero is due the moment it is assigned.
        </p>
        {prioritiesEditor}
      </div>
    );
  };

  const isStepCompleted = (step: number) => completedSteps.includes(step);

  return (
    <div>
      <PageHeader
        title="Configure SLA"
        subtitle="Response times for each priority level of a workflow."
        actions={
          <Button variant="ghost" icon={<FiX />} onClick={onCancel}>
            Cancel
          </Button>
        }
      />

      <div className="card">
        <div className="px-4 sm:px-8 pt-6 pb-5 border-b border-line-subtle max-w-xl mx-auto">
          <WizardStepper
            steps={[{ label: 'Select workflow' }, { label: 'Set response times' }]}
            current={currentStep}
            completed={completedSteps}
            onStepClick={(step) => {
              if (isStepCompleted(step) || step === currentStep) setCurrentStep(step);
            }}
          />
        </div>

        <div className="px-5 sm:px-8 py-7">{renderStepContent()}</div>

        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 border-t border-line-subtle bg-surface-muted rounded-b-card">
          <Button
            variant="secondary"
            icon={<FiChevronLeft />}
            onClick={() => {
              const previousStep = Math.max(1, currentStep - 1);
              setCompletedSteps(completedSteps.filter((step) => step < previousStep));
              setCurrentStep(previousStep);
            }}
            disabled={currentStep === 1}
          >
            Back
          </Button>
          {currentStep < totalSteps ? (
            <Button
              variant="primary"
              trailingIcon={<FiChevronRight />}
              onClick={() => {
                if (currentStep === 1 && !selectedWorkflowId) {
                  toast.error('Please select a workflow');
                  return;
                }
                if (!completedSteps.includes(currentStep)) {
                  setCompletedSteps([...completedSteps, currentStep]);
                }
                setCurrentStep(Math.min(totalSteps, currentStep + 1));
              }}
            >
              Next
            </Button>
          ) : (
            <Button variant="primary" loading={loading} disabled={!canSave} onClick={handleSubmit} icon={<FiCheck />}>
              {loading ? 'Saving…' : 'Save Configuration'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SLAConfigure;
