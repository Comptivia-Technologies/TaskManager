export interface Team {
  teamId: string;
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
  memberId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  teamId?: string;
  teamName?: string;
  role: string;
  skillLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberCreate {
  firstName: string;
  lastName: string;
  email: string;
  userId?: string;
  teamId?: string;
  role: string;
  skillLevel: number;
}

export interface MemberUpdate {
  firstName: string;
  lastName: string;
  email: string;
  teamId?: string;
  role: string;
  skillLevel: number;
}

export interface Workflow {
  workflowId: string;
  workflowName: string;
  description?: string;
  teamId?: string;
  teamName?: string;
  createdAt: string;
  updatedAt: string;
  stages: Stage[];
  tasks: Task[];
}

export interface WorkflowCreate {
  workflowName: string;
  description?: string;
  teamId?: string;
}

export interface WorkflowUpdate {
  workflowName: string;
  description?: string;
}

export type StageType = 'Process' | 'Escalation';
export type TransitionPolicy = 'OnComplete' | 'OnTimeout' | 'Manual';

export interface Stage {
  stageId: string;
  stageName: string;
  stageOrder: number;
  workflowId: string;
  teamId: string;
  teamName: string;
  stageType: StageType;
  transitionPolicy: TransitionPolicy;
  timeoutMinutes?: number;
  createdAt: string;
}

export interface StageCreate {
  stageName: string;
  stageOrder: number;
  workflowId: string;
  teamId: string;
  stageType: StageType;
  transitionPolicy: TransitionPolicy;
  timeoutMinutes?: number;
}

export interface StageUpdate {
  stageName: string;
  stageOrder: number;
  teamId: string;
  stageType: StageType;
  transitionPolicy: TransitionPolicy;
  timeoutMinutes?: number;
}

export interface Task {
  taskId: string;
  taskName: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  workflowId: string;
  stageId?: string;
  stageName?: string;
  assignedToMemberId?: string;
  assignedToMemberName?: string;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreate {
  taskName: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  workflowId: string;
  stageId?: string;
  assignedToMemberId?: string;
}

export interface TaskUpdate {
  taskName: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  stageId?: string;
  assignedToMemberId?: string;
}

export interface PaginatedTasksResponse {
  data: Task[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

// SLA and task priorities are now fully dynamic, so this is a free-form string
export type PriorityLevel = string;

export interface ManagedTask {
  taskId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  externalTaskId?: string;
  payload: unknown;
  workflowId: string;
  workflowName: string;
  slaConfigurationId?: string;
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
  teamId?: string;
}

export interface SLAConfiguration {
  workflowId: string;
  workflowName: string;
  priorityLevels: {
    // key is the priority name (e.g. "Very Critical", "High", etc.)
    [key: string]: {
      responseTime: number; // in minutes
    };
  };
}

export interface SLAConfigurationCreate {
  workflowId: string;
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
  completedTaskCount: number;
  overdueTaskCount: number;
  escalatedTaskCount: number;
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
  memberId: string;
  memberName: string;
  memberEmail: string;
  workloadScore: number;
  workloadStatus: 'Available' | 'PartiallyLoaded' | 'FullyLoaded' | 'Overloaded';
  metrics: WorkloadMetrics;
  breakdown: WorkloadBreakdown;
  calculatedAt: string;
}

export interface PriorityRule {
  ruleId: string;
  ruleName: string;
  priority: string;  // "Critical", "High", "Medium", "Low"
  salience: number;
  isActive: boolean;
  conditionsJson: string;
  maxWorkloadScore?: number;
  teamName?: string;
  workflowId?: string;  // NULL = global rule, specific ID = workflow-specific rule
  createdAt: string;
  updatedAt: string;
}

export interface PriorityRuleCreate {
  ruleName: string;
  priority: string;
  salience: number;
  isActive: boolean;
  conditionsJson: string;
  maxWorkloadScore?: number;
  teamName?: string;
  workflowId?: string;  // NULL = global rule, specific ID = workflow-specific rule
}

export interface PriorityRuleUpdate {
  ruleName: string;
  priority: string;
  salience: number;
  isActive: boolean;
  conditionsJson: string;
  maxWorkloadScore?: number;
  teamName?: string;
  workflowId?: string;  // NULL = global rule, specific ID = workflow-specific rule
}

export interface RuleCondition {
  path: string;
  op: string;
  value: any;
}

export interface RuleConditions {
  all?: RuleCondition[];
  any?: RuleCondition[];
}

export type UserStatus = 'Active' | 'Pending' | 'Archived';

export interface User {
  id?: string;
  userId: string;
  fullName: string;
  email: string;
  organisationId: string;
  role: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreate {
  fullName: string;
  email: string;
  organisationId: string;
  role: string;
}

export interface Role {
  roleId: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface RoleCreate {
  name: string;
  description?: string;
  permissions?: string[];
}

