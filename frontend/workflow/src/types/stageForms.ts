export type StageFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'assignee';

export interface StageFieldOption {
  value: string;
  label: string;
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
}

export interface StageFormSchema {
  title: string;
  description?: string;
  fields: StageField[];
}

export type StageFormValues = Record<string, string | number | boolean>;
