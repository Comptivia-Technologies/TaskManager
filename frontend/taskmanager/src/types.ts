export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ManagedTask {
  taskId: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  externalTaskId?: string;
  payload: unknown;
  workflowId: number;
  workflowName: string;
  slaConfigurationId?: number;
  slaPriority?: PriorityLevel | string;
  slaResponseTimeMinutes?: number;
  slaResolutionTimeMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedTaskCreate {
  title: string;
  description?: string;
  priority: PriorityLevel;
  externalTaskId?: string;
  payload?: unknown;
  teamId?: number;
}


