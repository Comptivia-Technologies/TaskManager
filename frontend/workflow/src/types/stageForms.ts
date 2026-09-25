export type StageFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'assignee'
  | 'table';

export interface StageFieldOption {
  value: string;
  label: string;
}

/** One column of a `table` field. Columns are always text or number. */
export interface StageColumn {
  name: string;
  label: string;
  type: 'text' | 'number';
  /** Filled in by an earlier stage and read-only here. */
  readOnly?: boolean;
  width?: 'narrow' | 'wide';
}

/**
 * Copies rows from a table submitted at an earlier stage, so procurement prices
 * the items the engineer actually listed rather than retyping them.
 */
export interface StagePrefill {
  /** Stage name the rows come from. */
  stage: string;
  /** Table field on that stage. */
  field: string;
  /** Columns to carry over; the rest start empty. */
  columns: string[];
}

export interface StageField {
  name: string;
  label: string;
  type: StageFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: StageFieldOption[];
  /**
   * For `assignee` fields: the name of the stage this appoints someone to. The
   * value is submitted as a nomination rather than as form data.
   */
  targetStage?: string;
  /** For `table` fields. */
  columns?: StageColumn[];
  addLabel?: string;
  prefillFrom?: StagePrefill;
}

export interface StageFormSchema {
  title: string;
  description?: string;
  fields: StageField[];
}

export type StageRow = Record<string, string | number>;

export type StageFormValue = string | number | boolean | StageRow[];

export type StageFormValues = Record<string, StageFormValue>;

export const isStageRows = (value: unknown): value is StageRow[] =>
  Array.isArray(value) && value.every((row) => row !== null && typeof row === 'object');
