namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task enters a stage with a different team
/// and needs to be reassigned to a member of the new team
/// </summary>
public class TaskStageReassignmentNeededEvent
{
    public Guid TaskId { get; set; }
    public int StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public int WorkflowId { get; set; }
    public int NewTeamId { get; set; }
    public int? PreviousMemberId { get; set; }
    public int? PreviousTeamId { get; set; }
    public string? TaskPriority { get; set; }
    public DateTime RequestedAt { get; set; }
    public Guid CorrelationId { get; set; }
}

