namespace WorkloadService.Domain.Entities;

/// <summary>
/// Reference Stage entity (from WorkflowManagement database)
/// </summary>
public class Stage
{
    public int StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public int WorkflowId { get; set; }
    public int TeamId { get; set; }
}

