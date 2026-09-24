import { FiPlus, FiTrash2 } from 'react-icons/fi';
import StageAssigneePicker from './StageAssigneePicker';
import { Stage } from '../types';
import {
  StageColumn,
  StageField,
  StageFormSchema,
  StageFormValues,
  StageRow,
  isStageRows,
} from '../types/stageForms';

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

const emptyRow = (columns: StageColumn[]): StageRow =>
  columns.reduce<StageRow>((row, column) => ({ ...row, [column.name]: '' }), {});

export const rowsOf = (value: unknown): StageRow[] => (isStageRows(value) ? value : []);

/**
 * Seeds a table from the stage that produced its inputs. Only runs while the
 * table is still empty, so a part-filled form is never overwritten.
 */
export const prefillTables = (
  schema: StageFormSchema,
  values: StageFormValues,
  submittedByStageName: Record<string, Record<string, unknown>>
): StageFormValues => {
  let next = values;
  schema.fields
    .filter((field) => field.type === 'table' && field.prefillFrom)
    .forEach((field) => {
      if (rowsOf(next[field.name]).length > 0) return;
      const source = submittedByStageName[field.prefillFrom!.stage.trim().toLowerCase()];
      const sourceRows = rowsOf(source?.[field.prefillFrom!.field]);
      if (sourceRows.length === 0) return;

      const columns = field.columns ?? [];
      const carried = field.prefillFrom!.columns;
      next = {
        ...next,
        [field.name]: sourceRows.map((row) => ({
          ...emptyRow(columns),
          ...carried.reduce<StageRow>(
            (kept, name) => (row[name] === undefined ? kept : { ...kept, [name]: row[name] }),
            {}
          ),
        })),
      };
    });
  return next;
};

const inputClass =
  'w-full px-3 py-2 border border-[#434E78]/30 rounded-azure-sm focus:outline-none focus:ring-2 focus:ring-[#434E78] focus:border-[#434E78] bg-white text-sm disabled:bg-gray-50 disabled:cursor-not-allowed';

const cellClass =
  'w-full px-2 py-1.5 border border-[#434E78]/20 rounded-azure-sm focus:outline-none focus:ring-1 focus:ring-[#434E78] bg-white text-sm disabled:bg-gray-50 disabled:cursor-not-allowed';

export const missingRequiredFields = (schema: StageFormSchema, values: StageFormValues): string[] =>
  schema.fields
    .filter((field) => {
      if (!field.required) return false;
      const value = values[field.name];
      if (field.type === 'checkbox') return value !== true;
      if (field.type === 'table') return rowsOf(value).length === 0;
      return value === undefined || value === null || String(value).trim() === '';
    })
    .map((field) => field.label);

const StageForm = ({ schema, values, onChange, readOnly = false, stages = [] }: StageFormProps) => {
  const setValue = (field: StageField, value: string | number | boolean | StageRow[]) =>
    onChange({ ...values, [field.name]: value });

  const renderTable = (field: StageField) => {
    const columns = field.columns ?? [];
    const rows = rowsOf(values[field.name]);

    const setRows = (next: StageRow[]) => setValue(field, next);
    const updateCell = (index: number, column: StageColumn, raw: string) =>
      setRows(
        rows.map((row, i) =>
          i === index ? { ...row, [column.name]: column.type === 'number' ? Number(raw) : raw } : row
        )
      );

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              {columns.map((column) => (
                <th key={column.name} className="px-2 py-1.5 text-xs font-semibold text-black/60">
                  {column.label}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-3 text-sm text-black/50">
                  Nothing added yet.
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              // Rows are reorderable only by add/remove, so the index is stable enough here.
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.name} className={column.width === 'wide' ? 'px-2 py-1 min-w-[16rem]' : 'px-2 py-1'}>
                    <input
                      aria-label={`${column.label} ${index + 1}`}
                      type={column.type}
                      disabled={readOnly || column.readOnly}
                      value={row[column.name] === undefined ? '' : String(row[column.name])}
                      onChange={(e) => updateCell(index, column, e.target.value)}
                      className={cellClass}
                    />
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-label={`Remove row ${index + 1}`}
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                    className="p-1.5 text-black/40 hover:text-red-600 disabled:opacity-40"
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => setRows([...rows, emptyRow(columns)])}
          className="mt-2 inline-flex items-center px-3 py-1.5 rounded-azure-sm border border-[#434E78]/30 text-[#434E78] text-sm font-medium hover:bg-[#434E78]/5 disabled:opacity-50"
        >
          <FiPlus className="mr-1.5" />
          {field.addLabel ?? 'Add row'}
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-azure-sm shadow-azure-sm border border-[#434E78]/20 overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-[#434E78]/10">
        <h2 className="text-lg font-semibold text-black">{schema.title}</h2>
        {schema.description && <p className="text-sm text-black/60 mt-1">{schema.description}</p>}
      </div>
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {schema.fields.map((field) => {
          const value = values[field.name];
          const isWide = field.type === 'textarea' || field.type === 'table';
          return (
            <div key={field.name} className={isWide ? 'md:col-span-2' : undefined}>
              <label htmlFor={field.name} className="block text-black text-sm font-semibold mb-2">
                {field.label}
                {field.required && <span className="text-red-600"> *</span>}
              </label>

              {field.type === 'table' && renderTable(field)}

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
                  value={
                    value === undefined || value === null || typeof value === 'boolean' || Array.isArray(value)
                      ? ''
                      : String(value)
                  }
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
