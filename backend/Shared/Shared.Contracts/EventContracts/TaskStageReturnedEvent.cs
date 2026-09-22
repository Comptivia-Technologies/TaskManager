namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task is sent back to an earlier stage.
/// </summary>
public class TaskStageReturnedEvent
{
    public Guid TaskId { get; set; }
    public Guid WorkflowId { get; set; }
    public Guid FromStageId { get; set; }
    public string FromStageName { get; set; } = string.Empty;
    public int FromStageOrder { get; set; }
    public Guid ToStageId { get; set; }
    public string ToStageName { get; set; } = string.Empty;
    public int ToStageOrder { get; set; }
    public Guid ReturnedByMemberId { get; set; }
    public string ReturnedByMemberName { get; set; } = string.Empty;
    public Guid ToMemberId { get; set; }
    public string ToMemberName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime ReturnedAt { get; set; }
    public Guid CorrelationId { get; set; }
}
