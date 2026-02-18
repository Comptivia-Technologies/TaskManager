namespace WorkloadService.Domain.Entities;

/// <summary>
/// Reference Stage entity (from WorkflowManagement database)
/// </summary>
public class Stage
{
    public Guid StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public Guid WorkflowId { get; set; }
    public Guid TeamId { get; set; }
}

