using TaskService.Domain.Enums;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Domain.Entities;

/// <summary>
/// Task entity - core domain model
/// </summary>
public class Task
{
    public Guid TaskId { get; set; } = Guid.NewGuid();
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = "Medium";
    public string TaskType { get; set; } = string.Empty;
    public DomainTaskStatus Status { get; set; } = DomainTaskStatus.Created;
    
    // Foreign keys (set by other services via events)
    public Guid? WorkflowId { get; set; }
    public Guid? MemberId { get; set; }
    public Guid? SLAConfigurationId { get; set; }
    
    // Stage tracking (for stage orchestration)
    public Guid? CurrentStageId { get; set; }
    public DateTime? CurrentStageStartedAt { get; set; }
    public DateTime? StageTimeoutAt { get; set; } // For escalation stages
    
    // SLA tracking
    public DateTime? SLADeadline { get; set; }
    public DateTime? SLAStartTime { get; set; }
    public bool IsOverdue { get; set; } = false;
    
    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Event tracking for idempotency
    public Guid? WorkflowSelectedEventId { get; set; }
    public Guid? SLAConfiguredEventId { get; set; }
    public Guid? TaskAssignedEventId { get; set; }
    public Guid? TaskOverdueEventId { get; set; }
    public Guid? TaskStageStartedEventId { get; set; }
    public Guid? TaskStageCompletedEventId { get; set; }
    public Guid? TaskStageEscalatedEventId { get; set; }
    public Guid? TaskStageEscalationTriggeredEventId { get; set; }
    public Guid? TaskCompletedEventId { get; set; }
}

