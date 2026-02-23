namespace WorkflowManagement.API.Models;

public class Task
{
    public Guid TaskId { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Pending";
    public string Priority { get; set; } = "Medium";
    public DateTime? DueDate { get; set; }
    public Guid WorkflowId { get; set; }
    public Guid? StageId { get; set; }
    public Guid? AssignedToMemberId { get; set; }
    public string? CompletedByMemberIds { get; set; }  // Comma-separated member IDs who completed stages on this task
    public string? EscalatedByMemberIds { get; set; }  // Comma-separated member IDs who escalated stages on this task
    public bool IsOverdue { get; set; } = false;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Workflow Workflow { get; set; } = null!;
    public Stage? Stage { get; set; }
    public Member? AssignedToMember { get; set; }
}


