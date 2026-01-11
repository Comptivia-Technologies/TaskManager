namespace WorkloadService.Domain.Entities;

/// <summary>
/// Reference Workflow entity (from WorkflowManagement database)
/// </summary>
public class Workflow
{
    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TeamId { get; set; }
}

