import Button, { IconButton } from '../components/Button';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Field from '../components/Field';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { inputClass } from '../utils/formStyles';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { priorityRulesService } from '../services/priorityRulesService';
import { PriorityRule, PriorityRuleCreate } from '../types';
import { useWorkflows } from '../hooks/useWorkflows';
import LoadingSpinner from '../components/LoadingSpinner';
import ConditionBuilder, { describeConditions } from '../components/ConditionBuilder';
import { FiCheck, FiEdit2, FiGitMerge, FiGlobe, FiPlus, FiSliders, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { priorityRank, priorityTone } from '../utils/status';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const EMPTY_FORM: PriorityRuleCreate = {
  ruleName: '',
  priority: 'Medium',
  salience: 0,
  isActive: true,
  conditionsJson: '{"all":[]}',
  maxWorkloadScore: undefined,
  teamName: undefined,
  workflowId: undefined,
};

const PriorityRules = () => {
  const { workflows, loading: workflowsLoading } = useWorkflows();
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PriorityRule | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<PriorityRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<PriorityRuleCreate>(EMPTY_FORM);

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

  // Global rules first, then one group per workflow — every workflow is listed,
  // even with no rules, so it is clear where a rule could be added.
  const groups = useMemo(() => {
    const byPriority = (a: PriorityRule, b: PriorityRule) => priorityRank(a.priority) - priorityRank(b.priority);
    return [
      { id: 'global' as const, name: 'All workflows', description: 'Global rules apply to every enquiry.', rules: rules.filter((r) => !r.workflowId).sort(byPriority) },
      ...workflows.map((w) => ({
        id: w.workflowId,
        name: w.workflowName,
        description: 'Only enquiries on this workflow.',
        rules: rules.filter((r) => r.workflowId === w.workflowId).sort(byPriority),
      })),
    ];
  }, [rules, workflows]);

  const handleAddRule = (workflowId: string | 'global') => {
    setEditingRule(null);
    setFormData({ ...EMPTY_FORM, workflowId: workflowId === 'global' ? undefined : workflowId });
    setShowModal(true);
  };

  const handleEdit = (rule: PriorityRule) => {
    setEditingRule(rule);
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

  const closeModal = () => {
    setShowModal(false);
    setEditingRule(null);
  };

  const handleDeleteRule = async (rule: PriorityRule) => {
    setDeleting(true);
    try {
      await priorityRulesService.delete(rule.ruleId);
      toast.success('Rule deleted successfully');
      setRuleToDelete(null);
      loadRules();
    } catch (error: any) {
      toast.error('Failed to delete rule');
      console.error('Error deleting rule:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.ruleName.trim()) {
      toast.error('Give the rule a name');
      return;
    }
    setSaving(true);
    try {
      // The scope picker writes formData.workflowId directly; creating from a
      // workflow's group pre-fills it, so formData is the single source here.
      const submitData: PriorityRuleCreate = { ...formData, workflowId: formData.workflowId || undefined };

      if (editingRule) {
        await priorityRulesService.update(editingRule.ruleId, submitData);
        toast.success('Rule updated successfully');
      } else {
        await priorityRulesService.create(submitData);
        toast.success('Rule created successfully');
      }
      closeModal();
      loadRules();
    } catch (error: any) {
      toast.error(editingRule ? 'Failed to update rule' : 'Failed to create rule');
      console.error('Error saving rule:', error);
    } finally {
      setSaving(false);
    }
  };

  if (workflowsLoading || loading) {
    return <LoadingSpinner label="Loading priority rules" />;
  }

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div>
      <PageHeader
        title="Priority Rules"
        subtitle="Conditions that set an enquiry's priority automatically when it is raised. The priority then decides its SLA target."
        meta={
          <>
            <span>{rules.length} rule{rules.length === 1 ? '' : 's'}</span>
            <span>{activeCount} active</span>
          </>
        }
        actions={
          <>
            <label className="inline-flex items-center gap-2.5 h-10 px-1 cursor-pointer text-body text-ink-muted select-none">
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="h-5 w-9 rounded-full bg-line-strong peer-checked:bg-primary transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2" />
                <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-azure-sm transition-transform peer-checked:translate-x-4" />
              </span>
              Active only
            </label>
            <Button variant="primary" icon={<FiPlus />} onClick={() => handleAddRule('global')}>
              Add Rule
            </Button>
          </>
        }
      />

      {workflows.length === 0 && rules.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FiSliders />}
            title="No workflows found"
            body="Create workflows first to configure priority rules."
          />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.id} className="card overflow-hidden" aria-labelledby={`rules-${group.id}`}>
              <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-line-subtle">
                <div className="flex items-center gap-3 min-w-0">
                  <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-control bg-surface-sunken text-ink-muted flex items-center justify-center">
                    {group.id === 'global' ? <FiGlobe /> : <FiGitMerge />}
                  </span>
                  <div className="min-w-0">
                    <h2 id={`rules-${group.id}`} className="text-body font-semibold text-ink truncate">
                      {group.name}
                    </h2>
                    <p className="text-meta text-ink-subtle">{group.description}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" icon={<FiPlus />} onClick={() => handleAddRule(group.id)}>
                  Add rule
                </Button>
              </header>
              {group.rules.length === 0 ? (
                <p className="px-5 py-4 text-body text-ink-subtle">No rules configured.</p>
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {group.rules.map((rule) => (
                    <li key={rule.ruleId} className={`flex items-center gap-4 px-5 py-3 ${rule.isActive ? '' : 'opacity-70'}`}>
                      <div className="w-[88px] shrink-0">
                        <Badge dot tone={priorityTone(rule.priority)}>{rule.priority}</Badge>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium text-ink truncate">
                          {rule.ruleName}
                          {!rule.isActive && <span className="ml-2 text-meta font-normal text-ink-subtle">Inactive</span>}
                        </p>
                        <p className="text-meta text-ink-subtle truncate" title={describeConditions(rule.conditionsJson)}>
                          When {describeConditions(rule.conditionsJson)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <IconButton size="sm" label={`Edit ${rule.ruleName}`} icon={<FiEdit2 />} onClick={() => handleEdit(rule)} />
                        <IconButton size="sm" tone="danger" label={`Delete ${rule.ruleName}`} icon={<FiTrash2 />} onClick={() => setRuleToDelete(rule)} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        title={editingRule ? 'Edit Priority Rule' : 'Create Priority Rule'}
        description="When its conditions match, a newly raised enquiry gets this priority."
        icon={<FiSliders />}
        size="lg"
        onClose={closeModal}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" icon={<FiCheck />} loading={saving} onClick={() => handleSubmit()}>
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field htmlFor="rule-name" label="Rule name" required>
            <input
              id="rule-name"
              type="text"
              required
              value={formData.ruleName}
              onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
              className={inputClass}
              placeholder="e.g. Government projects are high priority"
            />
          </Field>

          <fieldset>
            <legend className="block text-body font-medium text-ink mb-1.5">Sets priority to</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const checked = formData.priority === p;
                return (
                  <label
                    key={p}
                    className={`flex items-center gap-2 h-10 px-3 rounded-control border cursor-pointer text-body font-medium
                      has-[:focus-visible]:shadow-focus ${
                        checked ? 'border-primary bg-primary-subtle text-ink' : 'border-line-strong text-ink-muted hover:border-[#A9B0C4]'
                      }`}
                  >
                    <input
                      type="radio"
                      name="rule-priority"
                      value={p}
                      checked={checked}
                      onChange={() => setFormData({ ...formData, priority: p })}
                      className="sr-only"
                    />
                    <Badge dot tone={priorityTone(p)} className="!ring-0 !bg-transparent !px-0">{p}</Badge>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Field htmlFor="rule-scope" label="Applies to" help="A global rule applies to enquiries on every workflow.">
            <select
              id="rule-scope"
              value={formData.workflowId || ''}
              onChange={(e) => setFormData({ ...formData, workflowId: e.target.value || undefined })}
              className={inputClass}
            >
              <option value="">All workflows (global)</option>
              {workflows.map((workflow) => (
                <option key={workflow.workflowId} value={workflow.workflowId}>
                  {workflow.workflowName}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <p className="block text-body font-medium text-ink mb-1.5">Conditions</p>
            <ConditionBuilder
              value={formData.conditionsJson}
              onChange={(json) => setFormData((prev) => ({ ...prev, conditionsJson: json }))}
            />
          </div>

          <label className="flex items-center gap-2.5 text-body text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            Active
            <span className="text-ink-subtle">— inactive rules are kept but not evaluated</span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(ruleToDelete)}
        title="Delete rule"
        body={
          <>
            Delete <span className="font-medium text-ink">{ruleToDelete?.ruleName}</span>? New enquiries will no longer be
            checked against it.
          </>
        }
        confirmLabel="Delete rule"
        busy={deleting}
        onCancel={() => setRuleToDelete(null)}
        onConfirm={() => ruleToDelete && handleDeleteRule(ruleToDelete)}
      />
    </div>
  );
};

export default PriorityRules;
