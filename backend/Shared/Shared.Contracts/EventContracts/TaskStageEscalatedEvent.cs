namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a user manually escalates a stage to the next stage
/// Unlike TaskStageEscalationTriggeredEvent (automatic timeout), this is user-initiated
/// </summary>
public class TaskStageEscalatedEvent
{
    public Guid TaskId { get; set; }
    public Guid CurrentStageId { get; set; }
    public string CurrentStageName { get; set; } = string.Empty;
    public Guid? NextStageId { get; set; } // Null if this is the last stage
    public string? NextStageName { get; set; }
    public Guid WorkflowId { get; set; }
    public string EscalationReason { get; set; } = string.Empty;
    public DateTime EscalatedAt { get; set; }
    public Guid CorrelationId { get; set; }
}
