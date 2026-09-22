namespace Shared.Contracts.EventContracts;

/// <summary>
/// Event published when a task enters a stage with a different team
/// and needs to be reassigned to a member of the new team
/// </summary>
public class TaskStageReassignmentNeededEvent
{
    public Guid TaskId { get; set; }
    public Guid StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public Guid WorkflowId { get; set; }
    public Guid NewTeamId { get; set; }
    public Guid? PreviousMemberId { get; set; }
    public Guid? PreviousTeamId { get; set; }
    public string? TaskPriority { get; set; }
    /// <summary>
    /// When set, assign this member if they are still on the stage team.
    /// </summary>
    public Guid? PreferredMemberId { get; set; }
    public DateTime RequestedAt { get; set; }
    public Guid CorrelationId { get; set; }
}

