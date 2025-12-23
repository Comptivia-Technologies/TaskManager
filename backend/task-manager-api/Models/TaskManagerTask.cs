namespace TaskManager.API.Models;

public class TaskManagerTask
{
    public int TaskId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Open";
    public string Priority { get; set; } = "Medium";
    public string? ExternalTaskId { get; set; }
    public string PayloadJson { get; set; } = "{}";

    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;

    public int? SlaConfigurationId { get; set; }
    public string? SlaPriority { get; set; }
    public int? SlaResponseTimeMinutes { get; set; }
    public int? SlaResolutionTimeMinutes { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}


