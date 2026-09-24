import { inputClass } from '../utils/formStyles';
import { useState, useEffect, useId, useRef } from 'react';
import { RuleCondition, RuleConditions } from '../types';
import { FiCode, FiPlus, FiX } from 'react-icons/fi';

interface ConditionBuilderProps {
  value: string;
  onChange: (json: string) => void;
}

/** Fields a condition can test, with the label people read. */
export const CONDITION_FIELDS = [
  { value: '$.taskType', label: 'Task Type' },
  { value: '$.taskName', label: 'Task Name' },
  { value: '$.description', label: 'Description' },
  { value: '$.workflowName', label: 'Workflow Name' },
  { value: '$.taskData.value', label: 'Value (taskData)' },
  { value: '$.taskData.category', label: 'Category (taskData)' },
  { value: '$.taskData.severity', label: 'Severity (taskData)' },
  { value: '$.taskData.priority', label: 'Priority (taskData)' },
];

export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals', phrase: 'equals' },
  { value: 'notequals', label: 'Not Equals', phrase: 'is not' },
  { value: 'contains', label: 'Contains', phrase: 'contains' },
  { value: 'notcontains', label: 'Does Not Contain', phrase: 'does not contain' },
  { value: 'startswith', label: 'Starts With', phrase: 'starts with' },
  { value: 'endswith', label: 'Ends With', phrase: 'ends with' },
  { value: '>', label: 'Greater Than (>)', phrase: '>' },
  { value: '>=', label: 'Greater Than or Equal (>=)', phrase: '≥' },
  { value: '<', label: 'Less Than (<)', phrase: '<' },
  { value: '<=', label: 'Less Than or Equal (<=)', phrase: '≤' },
];

/**
 * A rule's conditions as a sentence — "Task Type equals Government and Value > 1000"
 * — so a list of rules can be read without opening each one.
 */
export const describeConditions = (conditionsJson: string): string => {
  try {
    const parsed: RuleConditions = JSON.parse(conditionsJson);
    const joiner = parsed.any && parsed.any.length > 0 ? ' or ' : ' and ';
    const list = (parsed.all && parsed.all.length > 0 ? parsed.all : parsed.any) ?? [];
    if (list.length === 0) return 'Always — no conditions';
    return list
      .map((c) => {
        const field = CONDITION_FIELDS.find((f) => f.value === c.path)?.label.replace(/ \(taskData\)$/, '') ?? c.path;
        const op = CONDITION_OPERATORS.find((o) => o.value === c.op)?.phrase ?? c.op;
        const value = c.value === '' || c.value === undefined ? '…' : `“${c.value}”`;
        return `${field} ${op} ${value}`;
      })
      .join(joiner);
  } catch {
    return 'Conditions could not be read';
  }
};

const ConditionBuilder = ({ value, onChange }: ConditionBuilderProps) => {
  const [conditionType, setConditionType] = useState<'all' | 'any'>('all');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const isInternalUpdate = useRef(false);
  const uid = useId().replace(/:/g, '');

  // Parse the JSON when it changes from outside, but not when this component wrote it.
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    if (value) {
      try {
        const parsed: RuleConditions = JSON.parse(value);
        const newType = parsed.all && parsed.all.length > 0 ? 'all' : (parsed.any && parsed.any.length > 0 ? 'any' : 'all');
        const newConditions = parsed.all && parsed.all.length > 0 ? parsed.all : (parsed.any && parsed.any.length > 0 ? parsed.any : []);

        setConditionType(newType);
        setConditions(newConditions);
        setJsonError(null);
      } catch (error) {
        setJsonError('Invalid JSON format');
      }
    } else {
      setConditionType('all');
      setConditions([]);
    }
  }, [value]);

  // Regenerate the JSON whenever the conditions or the logic change.
  useEffect(() => {
    const ruleConditions: RuleConditions = {
      [conditionType]: conditions.length === 0 ? [] : conditions,
    };

    try {
      const jsonString = JSON.stringify(ruleConditions, null, 2);
      // Only call onChange if the JSON is different to avoid infinite loops
      if (jsonString !== value) {
        isInternalUpdate.current = true;
        onChange(jsonString);
      }
      setJsonError(null);
    } catch (error) {
      setJsonError('Error generating JSON');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditions, conditionType]);

  const addCondition = () => {
    setConditions([...conditions, { path: '$.taskType', op: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof RuleCondition, newValue: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: newValue };
    setConditions(updated);
  };

  const getGeneratedJson = (): string => {
    if (conditions.length === 0) {
      return '{"all":[]}';
    }
    return JSON.stringify({ [conditionType]: conditions }, null, 2);
  };

  return (
    <div className="rounded-card border border-line overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-surface-muted border-b border-line">
        <div role="radiogroup" aria-labelledby={`${uid}-logic`} className="flex items-center gap-3">
          <span id={`${uid}-logic`} className="text-meta font-medium text-ink-muted">Condition Logic</span>
          <div className="inline-flex p-0.5 rounded-control bg-surface-sunken">
            {([
              ['all', 'Match all (AND)'],
              ['any', 'Match any (OR)'],
            ] as const).map(([type, label]) => (
              <label
                key={type}
                className={`relative h-7 px-3 inline-flex items-center rounded-[5px] text-meta font-medium cursor-pointer
                  has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${
                  conditionType === type ? 'bg-surface text-ink shadow-azure-sm' : 'text-ink-subtle hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="conditionType"
                  value={type}
                  checked={conditionType === type}
                  onChange={(e) => setConditionType(e.target.value as 'all' | 'any')}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <span className="text-meta text-ink-subtle tabular">
          {conditions.length} condition{conditions.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="p-4">
        {conditions.length === 0 ? (
          <p className="text-body text-ink-subtle text-center py-3">
            No conditions — the rule applies to every enquiry. Add one to narrow it.
          </p>
        ) : (
          <ol className="space-y-2">
            {conditions.map((condition, index) => (
              <li key={index}>
                {index > 0 && (
                  <p aria-hidden="true" className="text-label font-semibold uppercase text-primary pl-1 mb-2">
                    {conditionType === 'all' ? 'and' : 'or'}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)_2.25rem] gap-2 items-center">
                  <select
                    aria-label={`Condition ${index + 1} field`}
                    value={condition.path}
                    onChange={(e) => updateCondition(index, 'path', e.target.value)}
                    className={inputClass}
                  >
                    {CONDITION_FIELDS.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Condition ${index + 1} operator`}
                    value={condition.op}
                    onChange={(e) => updateCondition(index, 'op', e.target.value)}
                    className={inputClass}
                  >
                    {CONDITION_OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    aria-label={`Condition ${index + 1} value`}
                    value={condition.value || ''}
                    onChange={(e) => updateCondition(index, 'value', e.target.value)}
                    placeholder="Value"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    aria-label={`Remove condition ${index + 1}`}
                    title="Remove condition"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-control text-ink-subtle hover:text-danger hover:bg-danger-subtle cursor-pointer"
                  >
                    <FiX aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={addCondition}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control text-meta font-medium text-primary hover:bg-primary-subtle cursor-pointer"
          >
            <FiPlus aria-hidden="true" />
            Add Condition
          </button>
          <div className="flex items-center gap-3">
            {jsonError && <span className="text-meta text-danger">{jsonError}</span>}
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              aria-expanded={showPreview}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control text-meta font-medium text-ink-subtle hover:text-ink hover:bg-surface-sunken cursor-pointer"
            >
              <FiCode aria-hidden="true" />
              {showPreview ? 'Hide' : 'Show'} JSON
            </button>
          </div>
        </div>

        {conditions.length > 0 && (
          <p className="mt-3 text-meta text-ink-muted">
            <span className="font-medium text-ink">Reads as:</span> {describeConditions(getGeneratedJson())}
          </p>
        )}

        {showPreview && (
          <pre className="mt-3 text-meta leading-5 font-mono text-[#D6DBEE] bg-shell rounded-control p-3 overflow-x-auto scrollbar-thin">
            {getGeneratedJson()}
          </pre>
        )}
      </div>
    </div>
  );
};

export default ConditionBuilder;
