namespace TaskService.Application.DTOs;

public class TaskStageHistoryReadDto
{
    public Guid HistoryId { get; set; }
    public int Sequence { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public Guid MemberId { get; set; }
    public string MemberName { get; set; } = string.Empty;
    public Guid? FromStageId { get; set; }
    public string? FromStageName { get; set; }
    public Guid? ToStageId { get; set; }
    public string? ToStageName { get; set; }
    public string? Reason { get; set; }
    public DateTime OccurredAt { get; set; }
}
