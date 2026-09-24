namespace TaskService.Domain.Entities;

/// <summary>
/// Someone earlier in the workflow naming who should handle a later stage — the team
/// lead appointing the engineer, for example. Applied when that stage starts.
/// Append-only; the most recent nomination for a stage wins.
/// </summary>
public class TaskStageNomination
{
    public Guid NominationId { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid TaskId { get; set; }
    public Guid StageId { get; set; }
    public Guid MemberId { get; set; }
    public Guid? NominatedByMemberId { get; set; }
    public DateTime NominatedAt { get; set; }
}
