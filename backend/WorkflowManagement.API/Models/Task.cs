namespace WorkflowManagement.API.Models;

public class Task
{
    public int TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Pending";
    public string Priority { get; set; } = "Medium";
    public DateTime? DueDate { get; set; }
    public int WorkflowId { get; set; }
    public int? StageId { get; set; }
    public int? AssignedToMemberId { get; set; }
    public string? CompletedByMemberIds { get; set; }  // Comma-separated member IDs who completed stages on this task
    public bool IsOverdue { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Workflow Workflow { get; set; } = null!;
    public Stage? Stage { get; set; }
    public Member? AssignedToMember { get; set; }
}


