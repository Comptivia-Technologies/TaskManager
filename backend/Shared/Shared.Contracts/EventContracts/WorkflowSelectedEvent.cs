namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a workflow is selected for a task
/// </summary>
public class WorkflowSelectedEvent
{
    public Guid SelectionId { get; set; } // Unique ID for this workflow selection (for idempotency)
    public Guid TaskId { get; set; }
    public Guid WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public string TaskPriority { get; set; } = string.Empty;
    public string TaskType { get; set; } = string.Empty;
    public string? TaskName { get; set; }
    public string? Description { get; set; }
    public Dictionary<string, object>? TaskData { get; set; }  // Generic task-specific data for rule evaluation
    public Guid? TeamId { get; set; }

    /// <summary>
    /// When set, the first stage must go to this member instead of a workload pick.
    /// Carries the creator of a manually raised enquiry; mail-ingested ones leave it null.
    /// </summary>
    public Guid? PreferredMemberId { get; set; }

    public DateTime SelectedAt { get; set; }
    public Guid CorrelationId { get; set; }
}

