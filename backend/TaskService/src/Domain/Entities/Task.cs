using TaskService.Domain.Enums;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Domain.Entities;

/// <summary>
/// Task entity - core domain model
/// </summary>
public class Task
{
    public Guid TaskId { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = "Medium";
    public string TaskType { get; set; } = string.Empty;
    public DomainTaskStatus Status { get; set; } = DomainTaskStatus.Created;

    // Who raised the enquiry. Null for anything not created by a person, such as
    // the future mail ingestion.
    public Guid? CreatedByMemberId { get; set; }

    // The record itself, as submitted when the task was raised (e.g. an enquiry's
    // reference number, client and project). Shown on every stage screen.
    public string? DataJson { get; set; }

    // Set when a stage is sent back and cleared when that stage is completed again,
    // so a list can show "needs attention" without reading each task's history.
    public DateTime? ReturnedAt { get; set; }
    public string? ReturnReason { get; set; }
    public string? ReturnedFromStageName { get; set; }

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

