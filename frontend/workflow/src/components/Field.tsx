import { ReactNode } from 'react';
import { helpClass, labelClass } from '../utils/formStyles';

interface FieldProps {
  /** Must match the control's id so the label is its accessible name. */
  htmlFor?: string;
  label: ReactNode;
  required?: boolean;
  /** Secondary text beside the label, e.g. "(from Product Hub)". */
  hint?: ReactNode;
  help?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Label, control, then help or error — in that order, every time. The error sits
 * under the field it belongs to and is announced with the field.
 */
const Field = ({ htmlFor, label, required, hint, help, error, children, className = '' }: FieldProps) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={labelClass}>
      {label}
      {required && (
        <span className="text-danger ml-0.5" aria-hidden="true">
          *
        </span>
      )}
      {hint && <span className="ml-1.5 font-normal text-ink-subtle">{hint}</span>}
    </label>
    {children}
    {error ? (
      <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="mt-1.5 text-meta text-danger">
        {error}
      </p>
    ) : help ? (
      <p id={htmlFor ? `${htmlFor}-help` : undefined} className={helpClass}>
        {help}
      </p>
    ) : null}
  </div>
);

export default Field;
