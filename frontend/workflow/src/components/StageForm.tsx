import StageAssigneePicker from './StageAssigneePicker';
import { Stage } from '../types';
import { StageField, StageFormSchema, StageFormValues } from '../types/stageForms';

interface StageFormProps {
  schema: StageFormSchema;
  values: StageFormValues;
  onChange: (values: StageFormValues) => void;
  readOnly?: boolean;
  /** Needed to resolve an `assignee` field's target stage to its team. */
  stages?: Stage[];
}

/** Splits `assignee` answers out of the form values, keyed by target stage id. */
export const extractNominations = (
  schema: StageFormSchema,
  values: StageFormValues,
  stages: Stage[]
): Record<string, string> => {
  const nominations: Record<string, string> = {};
  schema.fields
    .filter((field) => field.type === 'assignee' && field.targetStage)
    .forEach((field) => {
      const target = stages.find(
        (s) => s.stageName.trim().toLowerCase() === field.targetStage!.trim().toLowerCase()
      );
      const chosen = values[field.name];
      if (target && typeof chosen === 'string' && chosen) {
        nominations[target.stageId] = chosen;
      }
    });
  return nominations;
};

const inputClass =
  'w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm disabled:bg-gray-50 disabled:cursor-not-allowed';

export const missingRequiredFields = (schema: StageFormSchema, values: StageFormValues): string[] =>
  schema.fields
    .filter((field) => {
      if (!field.required) return false;
      const value = values[field.name];
      if (field.type === 'checkbox') return value !== true;
      return value === undefined || value === null || String(value).trim() === '';
    })
    .map((field) => field.label);

const StageForm = ({ schema, values, onChange, readOnly = false, stages = [] }: StageFormProps) => {
  const setValue = (field: StageField, value: string | number | boolean) =>
    onChange({ ...values, [field.name]: value });

  return (
    <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-[#434E78]/10">
        <h2 className="text-lg font-semibold text-black">{schema.title}</h2>
        {schema.description && <p className="text-sm text-black/60 mt-1">{schema.description}</p>}
      </div>
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {schema.fields.map((field) => {
          const value = values[field.name];
          const isWide = field.type === 'textarea';
          return (
            <div key={field.name} className={isWide ? 'md:col-span-2' : undefined}>
              <label htmlFor={field.name} className="block text-black text-sm font-semibold mb-2">
                {field.label}
                {field.required && <span className="text-red-600"> *</span>}
              </label>

              {field.type === 'assignee' && (() => {
                const target = stages.find(
                  (s) => s.stageName.trim().toLowerCase() === (field.targetStage ?? '').trim().toLowerCase()
                );
                if (!target) {
                  return (
                    <p className="text-xs text-black/60">
                      Stage “{field.targetStage}” is not on this workflow, so nobody can be appointed.
                    </p>
                  );
                }
                return (
                  <StageAssigneePicker
                    teamId={target.teamId}
                    teamName={target.teamName}
                    stageName={target.stageName}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(memberId) => setValue(field, memberId)}
                    disabled={readOnly}
                  />
                );
              })()}

              {field.type === 'textarea' && (
                <textarea
                  id={field.name}
                  rows={4}
                  disabled={readOnly}
                  placeholder={field.placeholder}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => setValue(field, e.target.value)}
                  className={inputClass}
                />
              )}

              {field.type === 'select' && (
                <select
                  id={field.name}
                  disabled={readOnly}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => setValue(field, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}

              {field.type === 'checkbox' && (
                <label className="flex items-center gap-2 text-sm text-black">
                  <input
                    id={field.name}
                    type="checkbox"
                    disabled={readOnly}
                    checked={value === true}
                    onChange={(e) => setValue(field, e.target.checked)}
                    className="h-4 w-4 rounded border-[#434E78]/40 text-[#434E78] focus:ring-[#434E78]"
                  />
                  {field.placeholder ?? 'Yes'}
                </label>
              )}

              {(field.type === 'text' || field.type === 'number' || field.type === 'date') && (
                <input
                  id={field.name}
                  type={field.type}
                  disabled={readOnly}
                  placeholder={field.placeholder}
                  value={value === undefined || value === null || typeof value === 'boolean' ? '' : String(value)}
                  onChange={(e) =>
                    setValue(field, field.type === 'number' ? Number(e.target.value) : e.target.value)
                  }
                  className={inputClass}
                />
              )}

              {field.help && <p className="mt-1 text-xs text-black/60">{field.help}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StageForm;
