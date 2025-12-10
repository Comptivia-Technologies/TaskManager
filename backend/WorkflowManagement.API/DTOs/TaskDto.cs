using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class TaskReadDto
{
    public int TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public int WorkflowId { get; set; }
    public int? StageId { get; set; }
    public string? StageName { get; set; }
    public int? AssignedToMemberId { get; set; }
    public string? AssignedToMemberName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TaskCreateDto
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

    [Required]
    public int WorkflowId { get; set; }

    public int? StageId { get; set; }

    public int? AssignedToMemberId { get; set; }
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

    public int? StageId { get; set; }

    public int? AssignedToMemberId { get; set; }
}


