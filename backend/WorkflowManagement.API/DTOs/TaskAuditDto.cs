using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class TaskAuditEntryReadDto
{
    public Guid AuditId { get; set; }
    public Guid TaskId { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public Guid? MemberId { get; set; }
    public string? MemberName { get; set; }
    public Guid? FromMemberId { get; set; }
    public string? FromMemberName { get; set; }
    public Guid? ToMemberId { get; set; }
    public string? ToMemberName { get; set; }
    public Guid? StageId { get; set; }
    public string? StageName { get; set; }
    public Guid? NextStageId { get; set; }
    public string? NextStageName { get; set; }
    public string? Reason { get; set; }
    public Guid CorrelationId { get; set; }
    public DateTime OccurredAt { get; set; }
}

public class TaskAuditEntryCreateDto
{
    [Required]
    public Guid EventId { get; set; }

    [Required]
    [StringLength(50)]
    public string ActionType { get; set; } = string.Empty;

    public Guid? MemberId { get; set; }
    public Guid? FromMemberId { get; set; }
    public Guid? ToMemberId { get; set; }
    public Guid? StageId { get; set; }

    [StringLength(200)]
    public string? StageName { get; set; }

    public Guid? NextStageId { get; set; }

    [StringLength(200)]
    public string? NextStageName { get; set; }

    [StringLength(500)]
    public string? Reason { get; set; }

    [Required]
    public Guid CorrelationId { get; set; }

    public DateTime? OccurredAt { get; set; }
}
