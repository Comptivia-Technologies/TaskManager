import { isStageRows } from '../types/stageForms';

interface StageValuesProps {
  values: Record<string, unknown>;
  /** Field name to label, so a reader sees "Unit price" rather than "unitPrice". */
  labels?: Record<string, string>;
}

const prettify = (name: string) =>
  name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

const display = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const isNumeric = (value: unknown) => typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()));

/**
 * Read-only view of what a stage submitted. Tables render as tables — the earlier
 * flat dump turned a BOQ into "[object Object]". Long text gets the full width so
 * a scope summary is not squeezed into a third of the row.
 */
const StageValues = ({ values, labels = {} }: StageValuesProps) => {
  const labelFor = (name: string) => labels[name] ?? prettify(name);
  const entries = Object.entries(values);
  const tables = entries.filter(([, value]) => isStageRows(value) && value.length > 0);
  const plain = entries.filter(([, value]) => !isStageRows(value));
  const isLong = (value: unknown) => typeof value === 'string' && value.length > 60;

  return (
    <div className="space-y-5">
      {plain.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {plain.map(([key, value]) => (
            <div key={key} className={isLong(value) ? 'sm:col-span-2 lg:col-span-3' : undefined}>
              <dt className="text-meta text-ink-subtle">{labelFor(key)}</dt>
              <dd
                className={`mt-0.5 text-body text-ink break-words whitespace-pre-line ${
                  value === true ? 'text-success font-medium' : ''
                } ${isNumeric(value) ? 'font-mono tabular' : 'font-medium'}`}
              >
                {display(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {tables.map(([key, value]) => {
        const rows = isStageRows(value) ? value : [];
        const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
        const numericColumn = (column: string) => rows.every((row) => row[column] === undefined || row[column] === '' || isNumeric(row[column]));
        return (
          <div key={key}>
            <p className="text-meta text-ink-subtle mb-1.5">
              {labelFor(key)} <span className="tabular">· {rows.length} {rows.length === 1 ? 'line' : 'lines'}</span>
            </p>
            <div className="overflow-x-auto scrollbar-thin border border-line rounded-card">
              <table className="min-w-full text-body">
                <thead className="bg-surface-muted">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className={`px-3 h-9 eyebrow border-b border-line whitespace-nowrap ${numericColumn(column) ? 'text-right' : 'text-left'}`}
                      >
                        {labelFor(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {rows.map((row, index) => (
                    <tr key={index}>
                      {columns.map((column) => (
                        <td
                          key={column}
                          className={`px-3 py-2 text-ink ${numericColumn(column) ? 'text-right font-mono text-meta tabular' : ''}`}
                        >
                          {display(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StageValues;
