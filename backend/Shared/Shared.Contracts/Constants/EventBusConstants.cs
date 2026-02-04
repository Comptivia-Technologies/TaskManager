namespace Shared.Contracts.Constants;

/// <summary>
/// EventBridge event sources and detail types (replaces RabbitMQ exchanges and routing keys)
/// </summary>
public static class EventBusConstants
{
    // Event Sources (replaces exchanges)
    public const string TaskSource = "task-manager.task";
    public const string WorkflowSource = "task-manager.workflow";
    public const string SLASource = "task-manager.sla";
    public const string WorkloadSource = "task-manager.workload";
    public const string PrioritySource = "task-manager.priority";

    // Detail Types (replaces routing keys)
    public const string TaskCreated = "TaskCreated";
    public const string TaskCreatedForPriority = "TaskCreatedForPriority";
    public const string PriorityAssigned = "PriorityAssigned";
    public const string WorkflowSelected = "WorkflowSelected";
    public const string SLAConfigured = "SLAConfigured";
    public const string TaskAssigned = "TaskAssigned";
    public const string TaskOverdue = "TaskOverdue";
    public const string TaskStatusUpdated = "TaskStatusUpdated";
    public const string TaskStageStarted = "TaskStageStarted";
    public const string TaskStageCompleted = "TaskStageCompleted";
    public const string TaskStageEscalationTriggered = "TaskStageEscalationTriggered";
    public const string TaskStageReassignmentNeeded = "TaskStageReassignmentNeeded";
    public const string TaskCompleted = "TaskCompleted";

    // Queue Names (per service)
    public const string TaskServiceQueue = "task-service";
    public const string WorkflowServiceQueue = "workflow-service";
    public const string SLAServiceQueue = "sla-service";
    public const string WorkloadServiceQueue = "workload-service";
    public const string PriorityServiceQueue = "priority-service";
}
