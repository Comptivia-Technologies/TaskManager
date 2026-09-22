namespace WorkloadService.Domain.Entities;

/// <summary>
/// Tracks task assignments made by Workload Service
/// </summary>
public class TaskAssignment
{
    public Guid AssignmentId { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public Guid MemberId { get; set; }
    public double WorkloadScore { get; set; }
    public string AssignmentReason { get; set; } = string.Empty;
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    
    // Idempotency
    public Guid? SLAConfiguredEventId { get; set; }
    public Guid? CorrelationId { get; set; }
}

