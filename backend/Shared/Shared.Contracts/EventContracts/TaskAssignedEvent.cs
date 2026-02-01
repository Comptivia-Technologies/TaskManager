namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task is assigned to a member
/// </summary>
public class TaskAssignedEvent
{
    public Guid AssignmentId { get; set; } // Unique ID for this task assignment (for idempotency)
    public Guid TaskId { get; set; }
    public int MemberId { get; set; }
    public string MemberName { get; set; } = string.Empty;
    public string MemberEmail { get; set; } = string.Empty;
    public double WorkloadScore { get; set; }
    public DateTime AssignedAt { get; set; }
    public Guid CorrelationId { get; set; }
}

