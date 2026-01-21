namespace Shared.Contracts.Constants;

/// <summary>
/// RabbitMQ exchange and queue names
/// </summary>
public static class RabbitMQConstants
{
    // Exchanges
    public const string TaskExchange = "task.exchange";
    public const string WorkflowExchange = "workflow.exchange";
    public const string SLAExchange = "sla.exchange";
    public const string WorkloadExchange = "workload.exchange";

    // Routing Keys
    public const string TaskCreated = "task.created";
    public const string TaskCreatedForPriority = "task.created.forpriority";  // For priority rule engine
    public const string PriorityAssigned = "priority.assigned";
    public const string WorkflowSelected = "workflow.selected";
    public const string SLAConfigured = "sla.configured";
    public const string TaskAssigned = "task.assigned";
    public const string TaskOverdue = "task.overdue";
    public const string TaskStatusUpdated = "task.status.updated";

    // Queues
    public const string TaskCreatedQueue = "task.created.queue";
    public const string TaskCreatedForPriorityQueue = "task.created.forpriority.queue";  // Priority rule engine queue
    public const string PriorityAssignedQueue = "priority.assigned.queue";
    public const string PriorityAssignedTaskQueue = "priority.assigned.task.queue"; // Separate queue for TaskService
    public const string PriorityAssignedSLAQueue = "priority.assigned.sla.queue"; // Separate queue for SLAManagerService
    public const string TaskCreatedWorkflowQueue = "task.created.workflow.queue"; // Separate queue for WorkflowService
    public const string WorkflowSelectedQueue = "workflow.selected.queue";
    public const string WorkflowSelectedPriorityQueue = "workflow.selected.priority.queue"; // Separate queue for PriorityRuleEngine
    public const string SLAConfiguredQueue = "sla.configured.queue";
    public const string SLAConfiguredWorkloadQueue = "sla.configured.workload.queue"; // Separate queue for WorkloadService
    public const string TaskAssignedQueue = "task.assigned.queue";
    public const string TaskOverdueQueue = "task.overdue.queue";
    public const string TaskStatusUpdatedQueue = "task.status.updated.queue";

    // Dead Letter Queues
    public const string TaskCreatedDLQ = "task.created.dlq";
    public const string WorkflowSelectedDLQ = "workflow.selected.dlq";
    public const string SLAConfiguredDLQ = "sla.configured.dlq";
    public const string TaskAssignedDLQ = "task.assigned.dlq";
    public const string TaskOverdueDLQ = "task.overdue.dlq";
}

