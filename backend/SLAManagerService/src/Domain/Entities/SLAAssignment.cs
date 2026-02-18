namespace SLAManagerService.Domain.Entities;

/// <summary>
/// Tracks SLA assignment for tasks
/// </summary>
public class SLAAssignment
{
    public Guid SLAAssignmentId { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public Guid WorkflowId { get; set; }
    public string Priority { get; set; } = string.Empty;
    public int ResponseTimeMinutes { get; set; }
    public DateTime SLAStartTime { get; set; }
    public DateTime SLADeadline { get; set; }
    public bool IsOverdue { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Idempotency
    public Guid? WorkflowSelectedEventId { get; set; }
}

