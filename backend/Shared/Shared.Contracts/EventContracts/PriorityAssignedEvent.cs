namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when priority is assigned to a task by rule engine
/// </summary>
public class PriorityAssignedEvent
{
    public Guid TaskId { get; set; }
    public Guid WorkflowId { get; set; }  // Workflow ID for SLA configuration
    public string Priority { get; set; } = string.Empty;
    public string AssignedBy { get; set; } = "RuleEngine";  // "RuleEngine" or "Manual"
    public Guid? RuleId { get; set; }  // Which rule matched (null if default)
    public string RuleName { get; set; } = string.Empty;
    public Dictionary<string, object>? OriginalTaskData { get; set; }

    /// <summary>
    /// When set, the first stage must go to this member instead of a workload pick.
    /// Carries the creator of a manually raised enquiry; mail-ingested ones leave it null.
    /// </summary>
    public Guid? PreferredMemberId { get; set; }

    public Guid CorrelationId { get; set; }
    public DateTime AssignedAt { get; set; }
}

