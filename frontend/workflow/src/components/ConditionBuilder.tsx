import { useState, useEffect, useRef } from 'react';
import { RuleCondition, RuleConditions } from '../types';
import { FiPlus, FiX, FiEye, FiEyeOff } from 'react-icons/fi';

interface ConditionBuilderProps {
  value: string;
  onChange: (json: string) => void;
}

const ConditionBuilder = ({ value, onChange }: ConditionBuilderProps) => {
  const [conditionType, setConditionType] = useState<'all' | 'any'>('all');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const isInternalUpdate = useRef(false);

  // Available fields and labels for the condition builder
  const availableFields = [
    { value: '$.taskType', label: 'Task Type' },
    { value: '$.taskName', label: 'Task Name' },
    { value: '$.description', label: 'Description' },
    { value: '$.workflowName', label: 'Workflow Name' },
    { value: '$.taskData.value', label: 'Value (taskData)' },
    { value: '$.taskData.category', label: 'Category (taskData)' },
    { value: '$.taskData.severity', label: 'Severity (taskData)' },
    { value: '$.taskData.priority', label: 'Priority (taskData)' },
  ];

  // Available operators
  const availableOperators = [
    { value: 'equals', label: 'Equals' },
    { value: 'notequals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'notcontains', label: 'Does Not Contain' },
    { value: 'startswith', label: 'Starts With' },
    { value: 'endswith', label: 'Ends With' },
    { value: '>', label: 'Greater Than (>)' },
    { value: '>=', label: 'Greater Than or Equal (>=)' },
    { value: '<', label: 'Less Than (<)' },
    { value: '<=', label: 'Less Than or Equal (<=)' },
  ];

  // Parse JSON value on mount or when value changes externally (not from internal updates)
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
        // If JSON is invalid, try to keep existing conditions
        setJsonError('Invalid JSON format');
      }
    } else {
      setConditionType('all');
      setConditions([]);
    }
  }, [value]);

  // Generate JSON whenever conditions or type changes
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
    setConditions([
      ...conditions,
      {
        path: '$.taskType',
        op: 'equals',
        value: '',
      },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: keyof RuleCondition, newValue: any) => {
    const updated = [...conditions];
    updated[index] = {
      ...updated[index],
      [field]: newValue,
    };
    setConditions(updated);
  };

  const getGeneratedJson = (): string => {
    if (conditions.length === 0) {
      return '{"all":[]}';
    }
    const ruleConditions: RuleConditions = {
      [conditionType]: conditions,
    };
    return JSON.stringify(ruleConditions, null, 2);
  };

  return (
    <div className="space-y-4">
      {/* Condition Type Selector */}
      <div>
        <label className="block text-sm font-medium text-black mb-2 font-sans">
          Condition Logic
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="conditionType"
              value="all"
              checked={conditionType === 'all'}
              onChange={(e) => setConditionType(e.target.value as 'all' | 'any')}
              className="text-[#434E78]"
            />
            <span className="text-sm text-black font-sans">All conditions must match (AND)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="conditionType"
              value="any"
              checked={conditionType === 'any'}
              onChange={(e) => setConditionType(e.target.value as 'all' | 'any')}
              className="text-[#434E78]"
            />
            <span className="text-sm text-black font-sans">Any condition matches (OR)</span>
          </label>
        </div>
      </div>

      {/* Conditions List */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-black font-sans">
            Conditions
          </label>
          <button
            type="button"
            onClick={addCondition}
            className="text-sm text-[#434E78] hover:text-[#434E78]/80 font-medium flex items-center gap-1 font-sans"
          >
            <FiPlus className="text-base" />
            Add Condition
          </button>
        </div>

        {conditions.length === 0 ? (
          <div className="p-4 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20 text-center">
            <p className="text-sm text-black/60 font-sans">No conditions added. Click "Add Condition" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div
                key={index}
                className="p-4 bg-[#434E78]/5 rounded-azure-sm border border-[#434E78]/20"
              >
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-black mb-1 font-sans">
                      Field
                    </label>
                    <select
                      value={condition.path}
                      onChange={(e) => updateCondition(index, 'path', e.target.value)}
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] font-sans text-sm"
                    >
                      {availableFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-black mb-1 font-sans">
                      Operator
                    </label>
                    <select
                      value={condition.op}
                      onChange={(e) => updateCondition(index, 'op', e.target.value)}
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] font-sans text-sm"
                    >
                      {availableOperators.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-black mb-1 font-sans">
                      Value
                    </label>
                    <input
                      type="text"
                      value={condition.value || ''}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      placeholder="Enter value..."
                      className="w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] font-sans text-sm"
                    />
                  </div>

                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="w-full p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-azure-sm transition-colors"
                      title="Remove condition"
                    >
                      <FiX className="text-lg mx-auto" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON Preview Toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-sm text-[#434E78] hover:text-[#434E78]/80 font-medium flex items-center gap-1 font-sans"
        >
          {showPreview ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
          {showPreview ? 'Hide' : 'Show'} JSON Preview
        </button>
        {jsonError && (
          <span className="text-xs text-red-600 font-sans">{jsonError}</span>
        )}
      </div>

      {/* JSON Preview */}
      {showPreview && (
        <div className="p-3 bg-gray-50 rounded-azure-sm border border-[#434E78]/20">
          <label className="block text-xs font-medium text-black mb-1 font-sans">
            Generated JSON (read-only)
          </label>
          <pre className="text-xs font-mono text-black/70 overflow-x-auto font-sans">
            {getGeneratedJson()}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ConditionBuilder;

