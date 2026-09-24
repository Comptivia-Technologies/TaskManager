namespace TaskService.Domain.Entities;

/// <summary>
/// Append-only record of the form data submitted when a stage was completed.
/// A stage revisited after a return produces another row, so superseded
/// submissions remain available as approval evidence; readers take the latest
/// row per stage.
/// </summary>
public class TaskStageData
{
    public Guid StageDataId { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid TaskId { get; set; }
    public Guid StageId { get; set; }
    public string DataJson { get; set; } = "{}";
    public Guid? SubmittedByMemberId { get; set; }
    public DateTime SubmittedAt { get; set; }
}
