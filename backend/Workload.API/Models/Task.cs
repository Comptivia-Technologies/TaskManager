namespace Workload.API.Models;

/// <summary>
/// Reference model for Task from WorkflowManagement database
/// </summary>
public class Task
{
    public Guid TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Pending";
    public string Priority { get; set; } = "Medium";
    public DateTime? DueDate { get; set; }
    public Guid WorkflowId { get; set; }
    public Guid? StageId { get; set; }
    public Guid? AssignedToMemberId { get; set; }
    public string? CompletedByMemberIds { get; set; }  // Comma-separated member IDs who completed stages on this task
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

