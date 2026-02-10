import { useState, useEffect, useCallback } from 'react';
import { priorityRulesService } from '../services/priorityRulesService';
import { PriorityRule, PriorityRuleCreate, RuleConditions } from '../types';
import { useWorkflows } from '../hooks/useWorkflows';
import LoadingSpinner from '../components/LoadingSpinner';
import ConditionBuilder from '../components/ConditionBuilder';
import { FiSettings, FiPlus, FiEdit, FiTrash2, FiLayers } from 'react-icons/fi';
import { toast } from 'react-toastify';

const PriorityRules = () => {
  const { workflows, loading: workflowsLoading } = useWorkflows();
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PriorityRule | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | 'global' | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Group rules by workflow
  const [rulesByWorkflow, setRulesByWorkflow] = useState<Map<number | 'global', PriorityRule[]>>(new Map());

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await priorityRulesService.getAll(showActiveOnly);
      setRules(data);
    } catch (error: any) {
      toast.error('Failed to load priority rules');
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  }, [showActiveOnly]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    // Group rules by workflow
    const grouped = new Map<number | 'global', PriorityRule[]>();
    
    // Global rules (no workflowId)
    const globalRules = rules.filter(r => !r.workflowId);
    if (globalRules.length > 0) {
      grouped.set('global', globalRules);
    }
    
    // Workflow-specific rules
    workflows.forEach(workflow => {
      const workflowRules = rules.filter(r => r.workflowId === workflow.workflowId);
      if (workflowRules.length > 0) {
        grouped.set(workflow.workflowId, workflowRules);
      }
    });
    
    setRulesByWorkflow(grouped);
  }, [rules, workflows]);


  const handleAddRule = (workflowId: number | 'global') => {
    setSelectedWorkflowId(workflowId);
    setEditingRule(null);
    setFormData({
      ruleName: '',
      priority: 'Medium',
      salience: 0,
      isActive: true,
      conditionsJson: '{"all":[]}',
      maxWorkloadScore: undefined,
      teamName: undefined,
      workflowId: workflowId === 'global' ? undefined : workflowId,
    });
    setShowModal(true);
  };

  const handleEdit = (rule: PriorityRule) => {
    setEditingRule(rule);
    setSelectedWorkflowId(rule.workflowId || 'global');
    setFormData({
      ruleName: rule.ruleName,
      priority: rule.priority,
      salience: rule.salience,
      isActive: rule.isActive,
      conditionsJson: rule.conditionsJson,
      maxWorkloadScore: rule.maxWorkloadScore,
      teamName: rule.teamName,
      workflowId: rule.workflowId,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;

    try {
      await priorityRulesService.delete(id);
      toast.success('Rule deleted successfully');
      loadRules();
    } catch (error: any) {
      toast.error('Failed to delete rule');
      console.error('Error deleting rule:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Determine the workflowId to use
      let finalWorkflowId: number | undefined;
      
      if (editingRule) {
        // When editing, use formData.workflowId (user might have changed it)
        finalWorkflowId = formData.workflowId;
      } else {
        // When creating, prioritize selectedWorkflowId
        if (selectedWorkflowId && selectedWorkflowId !== 'global') {
          finalWorkflowId = selectedWorkflowId as number;
        } else if (selectedWorkflowId === 'global') {
          finalWorkflowId = undefined;
        } else {
          // Fallback to formData.workflowId if selectedWorkflowId is null
          finalWorkflowId = formData.workflowId;
        }
      }
      
      // Build submit data with explicit workflowId
      const submitData: PriorityRuleCreate = { 
        ...formData,
        workflowId: finalWorkflowId
      };
      
      // Debug logging
      console.log('Submitting rule:', {
        selectedWorkflowId,
        formDataWorkflowId: formData.workflowId,
        finalWorkflowId: submitData.workflowId,
        isEditing: !!editingRule,
        submitData: JSON.parse(JSON.stringify(submitData)) // Convert to plain object for logging
      });
      
      if (editingRule) {
        await priorityRulesService.update(editingRule.ruleId, submitData);
        toast.success('Rule updated successfully');
      } else {
        await priorityRulesService.create(submitData);
        toast.success('Rule created successfully');
      }
      setShowModal(false);
      // Reset selectedWorkflowId after successful submission
      setSelectedWorkflowId(null);
      setEditingRule(null);
      loadRules();
    } catch (error: any) {
      toast.error(editingRule ? 'Failed to update rule' : 'Failed to create rule');
      console.error('Error saving rule:', error);
      console.error('Error response:', error.response?.data);
      console.error('Submit data that failed:', {
        selectedWorkflowId,
        formDataWorkflowId: formData.workflowId,
        formData: formData
      });
    }
  };

  // Form state
  const [formData, setFormData] = useState<PriorityRuleCreate>({
    ruleName: '',
    priority: 'Medium',
    salience: 0,
    isActive: true,
    conditionsJson: '{"all":[]}',
    maxWorkloadScore: undefined,
    teamName: undefined,
    workflowId: undefined,
  });

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatConditions = (conditionsJson: string): string => {
    try {
      const conditions: RuleConditions = JSON.parse(conditionsJson);
      if (conditions.all && conditions.all.length > 0) {
        return `${conditions.all.length} condition(s)`;
      }
      if (conditions.any && conditions.any.length > 0) {
        return `${conditions.any.length} condition(s)`;
      }
      return 'No conditions';
    } catch {
      return 'Invalid JSON';
    }
  };

  const getWorkflowName = (workflowId?: number): string => {
    if (!workflowId) return 'Global';
    const workflow = workflows.find(w => w.workflowId === workflowId);
    return workflow?.workflowName || `Workflow #${workflowId}`;
  };

  if (workflowsLoading || loading) {
    return <LoadingSpinner />;
  }

  const globalRules = rulesByWorkflow.get('global') || [];

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-[#434E78]/20">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold text-black mb-1 font-sans tracking-tight">
                Priority Rules
              </h1>
              <p className="text-black/70 text-sm font-sans">
                Configure workflow-specific rules to automatically assign task priority
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-black/70">Active only</span>
            </label>
          </div>
        </div>

        {/* Global Rules Section */}
        {globalRules.length > 0 && (
          <div className="mb-6">
            <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden">
              <div className="bg-[#434E78]/5 px-5 py-3 border-b border-[#434E78]/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FiLayers className="text-[#434E78] text-lg" />
                  <h2 className="text-lg font-semibold text-black font-sans">Global Rules</h2>
                  <span className="text-xs text-black/60 font-sans">(Apply to all workflows)</span>
                </div>
                <button
                  onClick={() => handleAddRule('global')}
                  className="text-sm text-[#434E78] font-medium hover:text-[#434E78]/80 flex items-center gap-1 font-sans"
                >
                  <FiPlus className="text-base" />
                  Add Rule
                </button>
              </div>
              <div className="p-4 space-y-2">
                {globalRules.map((rule) => (
                  <div
                    key={rule.ruleId}
                    className="flex items-center justify-between p-3 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/10 hover:bg-[#434E78]/10 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-azure-sm text-xs font-medium border ${getPriorityColor(rule.priority)} font-sans`}>
                          {rule.priority}
                        </span>
                        <span className="text-sm font-semibold text-black font-sans">{rule.ruleName}</span>
                        {!rule.isActive && (
                          <span className="text-xs text-black/50 font-sans">(Inactive)</span>
                        )}
                      </div>
                      <div className="text-xs text-black/60 mt-1 font-sans">
                        {formatConditions(rule.conditionsJson)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="text-[#434E78] hover:text-[#434E78]/80 transition-colors"
                        title="Edit"
                      >
                        <FiEdit className="text-lg" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.ruleId)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="text-lg" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Workflows Grid */}
        {workflows.length === 0 ? (
          <div className="bg-white rounded-azure-sm shadow-azure-sm p-12 text-center border border-[#434E78]/20">
            <div className="max-w-md mx-auto">
              <div className="bg-[#434E78]/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FiSettings className="text-3xl text-[#434E78]" />
              </div>
              <h3 className="text-lg font-semibold text-black mb-2 font-sans">No workflows found</h3>
              <p className="text-black/70 text-sm font-sans">
                Create workflows first to configure priority rules.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => {
              const workflowRules = rulesByWorkflow.get(workflow.workflowId) || [];
              const activeRulesCount = workflowRules.filter(r => r.isActive).length;

              return (
                <div
                  key={workflow.workflowId}
                  className="bg-white rounded-azure-sm shadow-azure-sm hover:shadow-azure-md transition-all duration-200 border border-[#434E78]/20 overflow-hidden group flex flex-col"
                >
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <h2 className="text-lg font-semibold text-black group-hover:text-black/80 transition-colors font-sans">
                        {workflow.workflowName}
                      </h2>
                      {activeRulesCount > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" title={`${activeRulesCount} active rule(s)`}></div>
                        </div>
                      )}
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
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-black/60 font-sans">Rules</span>
                        <span className="font-medium text-black font-sans">
                          {workflowRules.length} rule{workflowRules.length !== 1 ? 's' : ''}
                          {activeRulesCount > 0 && ` (${activeRulesCount} active)`}
                        </span>
                      </div>

                      {workflowRules.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#434E78]/10 space-y-2 max-h-48 overflow-y-auto">
                          {workflowRules.map((rule) => (
                            <div
                              key={rule.ruleId}
                              className="flex items-center justify-between p-2 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/10"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getPriorityColor(rule.priority)} font-sans`}>
                                    {rule.priority}
                                  </span>
                                  <span className="text-xs font-semibold text-black truncate font-sans">{rule.ruleName}</span>
                                  {!rule.isActive && (
                                    <span className="text-xs text-black/50 font-sans">(Inactive)</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() => handleEdit(rule)}
                                  className="text-[#434E78] hover:text-[#434E78]/80 transition-colors"
                                  title="Edit"
                                >
                                  <FiEdit className="text-sm" />
                                </button>
                                <button
                                  onClick={() => handleDelete(rule.ruleId)}
                                  className="text-red-600 hover:text-red-800 transition-colors"
                                  title="Delete"
                                >
                                  <FiTrash2 className="text-sm" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {workflowRules.length === 0 && (
                        <div className="mt-3 pt-3 border-t border-[#434E78]/10">
                          <p className="text-xs text-black/50 text-center font-sans">No rules configured</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#434E78]/5 px-5 py-2.5 border-t border-[#434E78]/10">
                    <button
                      onClick={() => handleAddRule(workflow.workflowId)}
                      className="text-sm text-[#434E78] font-medium group-hover:text-[#434E78]/80 font-sans flex items-center gap-1"
                    >
                      <FiPlus className="text-base" />
                      Add Rule →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Global Rule Button (if no global rules exist) */}
        {globalRules.length === 0 && (
          <div className="mt-6">
            <button
              onClick={() => handleAddRule('global')}
              className="bg-[#434E78] text-white px-5 py-2.5 rounded-azure-sm hover:bg-[#434E78]/90 flex items-center shadow-azure-sm hover:shadow-azure-md transition-all font-medium text-sm"
            >
              <FiPlus className="mr-2" />
              Add Global Rule
            </button>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-azure-sm shadow-azure-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-semibold text-black mb-4 font-sans">
                {editingRule ? 'Edit Priority Rule' : 'Create Priority Rule'}
              </h2>
              {selectedWorkflowId && selectedWorkflowId !== 'global' && (
                <p className="text-sm text-black/70 mb-4 font-sans">
                  For workflow: <span className="font-semibold">{getWorkflowName(selectedWorkflowId as number)}</span>
                </p>
              )}
              {selectedWorkflowId === 'global' && (
                <p className="text-sm text-black/70 mb-4 font-sans">
                  <span className="font-semibold">Global Rule</span> (applies to all workflows)
                </p>
              )}
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-1 font-sans">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.ruleName}
                      onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-1 font-sans">
                      Priority *
                    </label>
                    <select
                      required
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] font-sans"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-2 font-sans">
                      Conditions *
                    </label>
                    <ConditionBuilder
                      value={formData.conditionsJson}
                      onChange={(json) => setFormData((prev) => ({ ...prev, conditionsJson: json }))}
                    />
                  </div>

                  {/* Show selected workflow when creating from a workflow card */}
                  {selectedWorkflowId && selectedWorkflowId !== 'global' && (
                    <div className="p-3 bg-[#434E78]/10 border border-[#434E78]/20 rounded-azure-sm">
                      <label className="block text-sm font-medium text-black mb-1 font-sans">
                        Selected Workflow
                      </label>
                      <p className="text-sm text-black/70 font-sans">
                        {workflows.find(w => w.workflowId === selectedWorkflowId)?.workflowName || `Workflow ID: ${selectedWorkflowId}`}
                      </p>
                      <p className="text-xs text-black/50 mt-1 font-sans">
                        This rule will apply only to this workflow
                      </p>
                    </div>
                  )}

                  {/* Only show workflow selector for global rules or when no workflow is pre-selected */}
                  {(!selectedWorkflowId || selectedWorkflowId === 'global') && (
                    <div>
                      <label className="block text-sm font-medium text-black mb-1 font-sans">
                        Workflow (optional)
                      </label>
                      <select
                        value={formData.workflowId || ''}
                        onChange={(e) => setFormData({ ...formData, workflowId: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] font-sans"
                      >
                        <option value="">Global (All Workflows)</option>
                        {workflows.map((workflow) => (
                          <option key={workflow.workflowId} value={workflow.workflowId}>
                            {workflow.workflowName}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-black/60 mt-1">
                        Leave empty for global rule, or select a specific workflow
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded"
                    />
                    <label className="text-sm font-medium text-black font-sans">
                      Active
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setSelectedWorkflowId(null);
                      setEditingRule(null);
                    }}
                    className="px-4 py-2 border border-[#434E78]/30 rounded-azure-sm text-black hover:bg-[#434E78]/5 transition-colors font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#434E78] text-white rounded-azure-sm hover:bg-[#434E78]/90 transition-colors font-sans"
                  >
                    {editingRule ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriorityRules;
