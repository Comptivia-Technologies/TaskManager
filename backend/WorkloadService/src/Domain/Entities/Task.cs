namespace WorkloadService.Domain.Entities;

/// <summary>
/// Reference Task entity (from WorkflowManagement database)
/// </summary>
public class Task
{
    public int TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string Priority { get; set; } = "Medium";
    public int? AssignedToMemberId { get; set; }
}

