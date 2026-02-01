namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task completes a stage
/// </summary>
public class TaskStageCompletedEvent
{
    public Guid TaskId { get; set; }
    public int StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int? NextStageId { get; set; } // Null if this is the last stage
    public string? NextStageName { get; set; }
    public int WorkflowId { get; set; }
    public DateTime CompletedAt { get; set; }
    public Guid CorrelationId { get; set; }
}

