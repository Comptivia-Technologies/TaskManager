namespace TaskService.Application.DTOs;

/// <summary>
/// The most recent submission for a stage of a task.
/// </summary>
public class TaskStageDataReadDto
{
    public Guid StageId { get; set; }
    public string DataJson { get; set; } = "{}";
    public Guid? SubmittedByMemberId { get; set; }
    public DateTime SubmittedAt { get; set; }
}
