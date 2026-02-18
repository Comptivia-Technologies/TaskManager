namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task completes all stages in the workflow
/// </summary>
public class TaskCompletedEvent
{
    public Guid TaskId { get; set; }
    public Guid WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public Guid FinalStageId { get; set; }
    public string FinalStageName { get; set; } = string.Empty;
    public DateTime CompletedAt { get; set; }
    public TimeSpan TotalDuration { get; set; }
    public Guid CorrelationId { get; set; }
}

