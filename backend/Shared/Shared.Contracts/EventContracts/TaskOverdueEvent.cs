namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task SLA deadline is breached
/// </summary>
public class TaskOverdueEvent
{
    public Guid TaskId { get; set; }
    public Guid MemberId { get; set; }
    public DateTime SLADeadline { get; set; }
    public DateTime BreachedAt { get; set; }
    public int MinutesOverdue { get; set; }
    public Guid CorrelationId { get; set; }
}

