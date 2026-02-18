namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a stage timeout triggers escalation to next stage
/// </summary>
public class TaskStageEscalationTriggeredEvent
{
    public Guid TaskId { get; set; }
    public Guid CurrentStageId { get; set; }
    public string CurrentStageName { get; set; } = string.Empty;
    public int? NextStageId { get; set; } // Null if this is the last stage
    public string? NextStageName { get; set; }
    public Guid WorkflowId { get; set; }
    public int TimeoutMinutes { get; set; }
    public DateTime EscalatedAt { get; set; }
    public DateTime? ExpectedCompletionAt { get; set; }
    public Guid CorrelationId { get; set; }
}

