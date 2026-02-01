namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task enters a stage
/// </summary>
public class TaskStageStartedEvent
{
    public Guid TaskId { get; set; }
    public int StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public string StageType { get; set; } = string.Empty; // "Process" or "Escalation"
    public int WorkflowId { get; set; }
    public int TeamId { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? StageTimeoutAt { get; set; } // For escalation stages
    public Guid CorrelationId { get; set; }
}

