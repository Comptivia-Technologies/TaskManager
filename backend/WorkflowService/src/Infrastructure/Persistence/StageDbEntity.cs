namespace WorkflowService.Infrastructure.Persistence;

/// <summary>
/// Database entity for Stages table (matches database structure with int enums)
/// </summary>
public class StageDbEntity
{
    public Guid StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public Guid WorkflowId { get; set; }
    public Guid TeamId { get; set; }
    public int StageType { get; set; } // 0 = Process, 1 = Escalation
    public int TransitionPolicy { get; set; } // 0 = OnComplete, 1 = OnTimeout, 2 = Manual
    public int? TimeoutMinutes { get; set; }
}

