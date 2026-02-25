using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class MemberTaskSummaryDto
{
    public IEnumerable<TaskReadDto> AssignedToMe { get; set; } = new List<TaskReadDto>();
    public IEnumerable<TaskReadDto> CompletedByMe { get; set; } = new List<TaskReadDto>();
    public IEnumerable<TaskReadDto> EscalatedByMe { get; set; } = new List<TaskReadDto>();
}

public class TaskReadDto
{
    public Guid TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public Guid WorkflowId { get; set; }
    public string? WorkflowName { get; set; }
    public Guid? StageId { get; set; }
    public string? StageName { get; set; }
    public Guid? AssignedToMemberId { get; set; }
    public string? AssignedToMemberName { get; set; }
    public string? CompletedByMemberIds { get; set; }  // Comma-separated member IDs who completed stages
    public string? EscalatedByMemberIds { get; set; }  // Comma-separated member IDs who escalated stages
    public bool IsOverdue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TaskCreateDto
{
    public Guid? TaskId { get; set; }  // Optional: allows TaskService to sync with same TaskId

    [Required]
    [StringLength(200)]
    public string TaskName { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Pending";

    [Required]
    [StringLength(50)]
    public string Priority { get; set; } = "Medium";

    public DateTime? DueDate { get; set; }

    [Required]
    public Guid WorkflowId { get; set; }

    public Guid? StageId { get; set; }

    public Guid? AssignedToMemberId { get; set; }
}

public class TaskUpdateDto
{
    [Required]
    [StringLength(200)]
    public string TaskName { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required]
    [StringLength(50)]
    public string Status { get; set; } = "Pending";

    [Required]
    [StringLength(50)]
    public string Priority { get; set; } = "Medium";

    public DateTime? DueDate { get; set; }

    public Guid? StageId { get; set; }

    public Guid? AssignedToMemberId { get; set; }

    [StringLength(500)]
    public string? CompletedByMemberIds { get; set; }  // Comma-separated member IDs who completed stages

    [StringLength(500)]
    public string? EscalatedByMemberIds { get; set; }  // Comma-separated member IDs who escalated stages

    public bool IsOverdue { get; set; }
}


