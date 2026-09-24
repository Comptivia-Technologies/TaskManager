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

/**
 * Read-only view of what a stage submitted. Tables render as tables — the earlier
 * flat dump turned a BOQ into "[object Object]".
 */
const StageValues = ({ values, labels = {} }: StageValuesProps) => {
  const labelFor = (name: string) => labels[name] ?? prettify(name);
  const entries = Object.entries(values);
  const tables = entries.filter(([, value]) => isStageRows(value) && value.length > 0);
  const plain = entries.filter(([, value]) => !isStageRows(value));

  return (
    <div className="space-y-5">
      {plain.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {plain.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-black/60">{labelFor(key)}</dt>
              <dd className="font-medium text-black break-words">{display(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {tables.map(([key, value]) => {
        const rows = isStageRows(value) ? value : [];
        const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
        return (
          <div key={key}>
            <p className="text-xs text-black/60 mb-1.5">{labelFor(key)}</p>
            <div className="overflow-x-auto border border-[#434E78]/15 rounded-azure-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-[#434E78]/5">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-3 py-2 text-left text-xs font-semibold text-black/60">
                        {labelFor(column)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#434E78]/10">
                  {rows.map((row, index) => (
                    <tr key={index}>
                      {columns.map((column) => (
                        <td key={column} className="px-3 py-2 text-black">
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
