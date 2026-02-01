namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when task status changes
/// </summary>
public class TaskStatusUpdatedEvent
{
    public Guid TaskId { get; set; }
    public string PreviousStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public Guid CorrelationId { get; set; }
}

