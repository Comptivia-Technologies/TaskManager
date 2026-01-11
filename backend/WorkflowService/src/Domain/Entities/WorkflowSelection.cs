namespace WorkflowService.Domain.Entities;

/// <summary>
/// Tracks workflow selection for tasks
/// </summary>
public class WorkflowSelection
{
    public Guid SelectionId { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public string SelectionReason { get; set; } = string.Empty; // Why this workflow was selected
    public DateTime SelectedAt { get; set; } = DateTime.UtcNow;
    
    // Idempotency
    public Guid? TaskCreatedEventId { get; set; }
}

