namespace TaskService.Domain.Entities;

/// <summary>
/// Append-only record of stage assignment, completion, and return.
/// </summary>
public class TaskStageHistory
{
    public const string Assigned = "Assigned";
    public const string Completed = "Completed";
    public const string Returned = "Returned";

    public Guid HistoryId { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid TaskId { get; set; }
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
    public Guid CorrelationId { get; set; }
}
