using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class WorkflowReadDto
{
    public Guid WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? TeamId { get; set; }
    public string? TeamName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<StageReadDto> Stages { get; set; } = new();
    public List<TaskReadDto> Tasks { get; set; } = new();
}

public class WorkflowCreateDto
{
    [Required]
    [StringLength(200)]
    public string WorkflowName { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public Guid? TeamId { get; set; }
}

public class WorkflowUpdateDto
{
    [Required]
    [StringLength(200)]
    public string WorkflowName { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }
}


