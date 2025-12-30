export interface Team {
  teamId: number;
  teamName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  workflowNames?: string[];
}

export interface TeamCreate {
  teamName: string;
  description?: string;
}

export interface TeamUpdate {
  teamName: string;
  description?: string;
}

export interface Member {
  memberId: number;
  firstName: string;
  lastName: string;
  email: string;
  teamId: number;
  teamName: string;
  role: string;
  skillLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberCreate {
  firstName: string;
  lastName: string;
  email: string;
  teamId: number;
  role: string;
  skillLevel: number;
}

export interface MemberUpdate {
  firstName: string;
  lastName: string;
  email: string;
  teamId: number;
  role: string;
  skillLevel: number;
}

export interface Workflow {
  workflowId: number;
  workflowName: string;
  description?: string;
  teamId?: number;
  teamName?: string;
  createdAt: string;
  updatedAt: string;
  stages: Stage[];
  tasks: Task[];
}

export interface WorkflowCreate {
  workflowName: string;
  description?: string;
  teamId?: number;
}

export interface WorkflowUpdate {
  workflowName: string;
  description?: string;
}

export interface Stage {
  stageId: number;
  stageName: string;
  stageOrder: number;
  workflowId: number;
  teamId: number;
  teamName: string;
  createdAt: string;
}

export interface StageCreate {
  stageName: string;
  stageOrder: number;
  workflowId: number;
  teamId: number;
}

export interface StageUpdate {
  stageName: string;
  stageOrder: number;
  teamId: number;
}

export interface Task {
  taskId: number;
  taskName: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  workflowId: number;
  stageId?: number;
  stageName?: string;
  assignedToMemberId?: number;
  assignedToMemberName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreate {
  taskName: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  workflowId: number;
  stageId?: number;
  assignedToMemberId?: number;
}

export interface TaskUpdate {
  taskName: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  stageId?: number;
  assignedToMemberId?: number;
}

// SLA and task priorities are now fully dynamic, so this is a free-form string
export type PriorityLevel = string;

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

export interface SLAConfiguration {
  workflowId: number;
  workflowName: string;
  priorityLevels: {
    // key is the priority name (e.g. "Very Critical", "High", etc.)
    [key: string]: {
      responseTime: number; // in minutes
    };
  };
}

export interface SLAConfigurationCreate {
  workflowId: number;
  priorityLevels: {
    [key: string]: {
      responseTime: number;
    };
  };
}

export interface SLAConfigurationUpdate {
  priorityLevels: {
    [key: string]: {
      responseTime: number;
    };
  };
}

export interface WorkloadMetrics {
  efficiency: number;
  skillLevel: number;
  taskCompletionRate: number;
  activeTaskCount: number;
  pendingTaskCount: number;
  totalTaskCount: number;
  isAvailable: boolean;
}

export interface WorkloadBreakdown {
  efficiencyScore: number;
  skillLevelScore: number;
  taskCompletionScore: number;
  activeTaskLoadScore: number;
  availabilityScore: number;
}

export interface WorkloadResponse {
  memberId: number;
  memberName: string;
  memberEmail: string;
  workloadScore: number;
  workloadStatus: 'Available' | 'PartiallyLoaded' | 'FullyLoaded' | 'Overloaded';
  metrics: WorkloadMetrics;
  breakdown: WorkloadBreakdown;
  calculatedAt: string;
}

