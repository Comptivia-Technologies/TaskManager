namespace TaskService.Application.DTOs;

public class TaskAuditRecordDto
{
    public Guid EventId { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public Guid? MemberId { get; set; }
    public Guid? FromMemberId { get; set; }
    public Guid? ToMemberId { get; set; }
    public Guid? StageId { get; set; }
    public string? StageName { get; set; }
    public Guid? NextStageId { get; set; }
    public string? NextStageName { get; set; }
    public string? Reason { get; set; }
    public Guid CorrelationId { get; set; }
    public DateTime? OccurredAt { get; set; }
}
