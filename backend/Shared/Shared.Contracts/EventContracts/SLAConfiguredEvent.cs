namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when SLA is configured for a task
/// </summary>
public class SLAConfiguredEvent
{
    public Guid SLAAssignmentId { get; set; } // Unique ID for this SLA assignment (for idempotency)
    public Guid TaskId { get; set; }
    public Guid WorkflowId { get; set; }
    public string Priority { get; set; } = string.Empty;
    public int ResponseTimeMinutes { get; set; }
    public DateTime SLAStartTime { get; set; }
    public DateTime SLADeadline { get; set; }

    /// <summary>
    /// When set, the first stage must go to this member instead of a workload pick.
    /// Carries the creator of a manually raised enquiry; mail-ingested ones leave it null.
    /// </summary>
    public Guid? PreferredMemberId { get; set; }

    public Guid CorrelationId { get; set; }
}

