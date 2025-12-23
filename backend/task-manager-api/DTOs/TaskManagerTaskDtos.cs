using System.ComponentModel.DataAnnotations;

namespace TaskManager.API.DTOs;

public class TaskManagerTaskReadDto
{
    public int TaskId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string? ExternalTaskId { get; set; }
    public object? Payload { get; set; }

    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;

    public int? SlaConfigurationId { get; set; }
    public string? SlaPriority { get; set; }
    public int? SlaResponseTimeMinutes { get; set; }
    public int? SlaResolutionTimeMinutes { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TaskManagerTaskCreateDto
{
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [Required]
    [StringLength(50)]
    public string Priority { get; set; } = "Medium";

    [StringLength(200)]
    public string? ExternalTaskId { get; set; }

    /// <summary>
    /// Arbitrary JSON payload for the task. This will be persisted as JSON.
    /// </summary>
    public object? Payload { get; set; }

    /// <summary>
    /// Optional team hint that can be used by the rule-based workflow evaluation.
    /// </summary>
    public int? TeamId { get; set; }
}


