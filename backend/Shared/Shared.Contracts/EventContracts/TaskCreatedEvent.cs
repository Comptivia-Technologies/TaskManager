namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a new task is created
/// </summary>
public class TaskCreatedEvent
{
    public Guid TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = "Medium";
    public string TaskType { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public Guid CorrelationId { get; set; } = Guid.NewGuid();
}

