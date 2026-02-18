namespace WorkloadService.Domain.Entities;

/// <summary>
/// Reference Workflow entity (from WorkflowManagement database)
/// </summary>
public class Workflow
{
    public Guid WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? TeamId { get; set; }
}

