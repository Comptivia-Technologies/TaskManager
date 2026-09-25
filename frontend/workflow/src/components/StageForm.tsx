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
import { inputClass } from '../utils/formStyles';

interface StageFormProps {
  schema: StageFormSchema;
  values: StageFormValues;
  onChange: (values: StageFormValues) => void;
  readOnly?: boolean;
  /** Needed to resolve an `assignee` field's target stage to its team. */
  stages?: Stage[];
  /** Labels of required fields left empty on the last attempt; flagged inline. */
  missing?: string[];
  /** Drop the card chrome when the form sits inside another container. */
  bare?: boolean;
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

// Every field on a stage form can be shown read-only while a submission is in
// flight, so the disabled styling belongs on all of them.
const fieldClass = inputClass;

// Cells read as a spreadsheet: borderless until hovered or focused, so a BOQ of
// twenty lines is a grid of values rather than a wall of boxes.
const cellClass =
  'w-full h-9 px-2.5 border border-transparent rounded-control bg-transparent text-body text-ink ' +
  'hover:border-line-strong hover:bg-surface focus:outline-none focus:border-primary focus:bg-surface focus:shadow-focus ' +
  'disabled:text-ink-muted disabled:cursor-not-allowed disabled:hover:border-transparent';

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

const StageForm = ({ schema, values, onChange, readOnly = false, stages = [], missing = [], bare = false }: StageFormProps) => {
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

    const numeric = (column: StageColumn) => column.type === 'number';

    return (
      <div className="rounded-card border border-line overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-body">
            <thead className="bg-surface-muted">
              <tr className="text-left">
                <th scope="col" className="w-10 px-3 h-9 eyebrow border-b border-line">#</th>
                {columns.map((column) => (
                  <th
                    key={column.name}
                    scope="col"
                    className={`px-2.5 h-9 eyebrow border-b border-line whitespace-nowrap ${numeric(column) ? 'text-right' : ''}`}
                  >
                    {column.label}
                  </th>
                ))}
                <th className="w-10 border-b border-line" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="px-4 py-6 text-center text-body text-ink-subtle">
                    Nothing added yet.
                  </td>
                </tr>
              )}
              {rows.map((row, index) => (
                // Rows are reorderable only by add/remove, so the index is stable enough here.
                <tr key={index} className="group hover:bg-surface-muted/60">
                  <td className="px-3 font-mono text-meta text-ink-subtle tabular">{index + 1}</td>
                  {columns.map((column) => (
                    <td
                      key={column.name}
                      className={`px-1 py-1 ${column.width === 'wide' ? 'min-w-[15rem]' : column.width === 'narrow' ? 'min-w-[6rem]' : 'min-w-[9rem]'}`}
                    >
                      <input
                        aria-label={`${column.label} ${index + 1}`}
                        type={column.type}
                        disabled={readOnly || column.readOnly}
                        value={row[column.name] === undefined ? '' : String(row[column.name])}
                        onChange={(e) => updateCell(index, column, e.target.value)}
                        className={`${cellClass} ${numeric(column) ? 'text-right font-mono tabular text-meta' : ''}`}
                      />
                    </td>
                  ))}
                  <td className="px-1.5">
                    <button
                      type="button"
                      disabled={readOnly}
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() => setRows(rows.filter((_, i) => i !== index))}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-control text-ink-subtle
                        opacity-60 group-hover:opacity-100 hover:text-danger hover:bg-danger-subtle disabled:opacity-30 cursor-pointer"
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-line bg-surface-muted">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setRows([...rows, emptyRow(columns)])}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control text-meta font-medium text-primary
              hover:bg-primary-subtle disabled:opacity-50 cursor-pointer"
          >
            <FiPlus aria-hidden="true" />
            {field.addLabel ?? 'Add row'}
          </button>
          <span className="text-meta text-ink-subtle tabular">
            {rows.length} {rows.length === 1 ? 'line' : 'lines'}
          </span>
        </div>
      </div>
    );
  };

  const body = (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5 ${bare ? '' : 'px-5 py-5'}`}>
        {schema.fields.map((field) => {
          const value = values[field.name];
          const isWide = field.type === 'textarea' || field.type === 'table';
          const isMissing = missing.includes(field.label);
          const errorId = `${field.name}-error`;
          return (
            <div key={field.name} className={isWide ? 'md:col-span-2' : undefined} data-missing={isMissing || undefined}>
              <label htmlFor={field.name} className="block text-body font-medium text-ink mb-1.5">
                {field.label}
                {field.required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
              </label>

              {field.type === 'table' && renderTable(field)}

              {field.type === 'assignee' && (() => {
                const target = stages.find(
                  (s) => s.stageName.trim().toLowerCase() === (field.targetStage ?? '').trim().toLowerCase()
                );
                if (!target) {
                  return (
                    <p className="text-meta text-ink-subtle">
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
                  aria-invalid={isMissing || undefined}
                  aria-describedby={isMissing ? errorId : undefined}
                  className={`${fieldClass} ${isMissing ? 'border-danger' : ''}`}
                />
              )}

              {field.type === 'select' && (
                <select
                  id={field.name}
                  disabled={readOnly}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => setValue(field, e.target.value)}
                  aria-invalid={isMissing || undefined}
                  aria-describedby={isMissing ? errorId : undefined}
                  className={`${fieldClass} ${isMissing ? 'border-danger' : ''}`}
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
                <label
                  className={`flex items-center gap-2.5 min-h-[40px] px-3 rounded-control border text-body text-ink cursor-pointer
                    ${value === true ? 'border-success-border bg-success-subtle' : isMissing ? 'border-danger bg-danger-subtle/40' : 'border-line-strong bg-surface hover:border-[#A9B0C4]'}`}
                >
                  <input
                    id={field.name}
                    type="checkbox"
                    disabled={readOnly}
                    checked={value === true}
                    onChange={(e) => setValue(field, e.target.checked)}
                    aria-invalid={isMissing || undefined}
                    className="h-4 w-4 rounded"
                  />
                  {field.placeholder ?? 'Yes, confirmed'}
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
                  aria-invalid={isMissing || undefined}
                  aria-describedby={isMissing ? errorId : undefined}
                  className={`${fieldClass} ${field.type === 'number' ? 'font-mono tabular' : ''} ${isMissing ? 'border-danger' : ''}`}
                />
              )}

              {isMissing ? (
                <p id={errorId} className="mt-1.5 text-meta text-danger">
                  {field.type === 'table' ? 'Add at least one line.' : field.type === 'checkbox' ? 'Confirm this before completing.' : 'Required.'}
                </p>
              ) : (
                field.help && <p className="mt-1.5 text-meta text-ink-subtle">{field.help}</p>
              )}
            </div>
          );
        })}
      </div>
  );

  if (bare) return body;

  const required = schema.fields.filter((f) => f.required).length;

  return (
    <section className="card overflow-hidden" aria-labelledby="stage-form-title">
      <header className="px-5 pt-4 pb-3 border-b border-line-subtle flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="stage-form-title" className="text-title font-semibold text-ink">{schema.title}</h2>
          {schema.description && <p className="text-meta text-ink-subtle mt-0.5">{schema.description}</p>}
        </div>
        {required > 0 && (
          <span className="text-meta text-ink-subtle">
            <span className="text-danger">*</span> {required} required
          </span>
        )}
      </header>
      {body}
    </section>
  );
};

export default StageForm;
