namespace WorkflowManagement.API.Models;

/// <summary>
/// Stage model with support for Process and Escalation workflows
/// </summary>
public class Stage
{
    public int StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public int WorkflowId { get; set; }
    public int TeamId { get; set; }
    
    /// <summary>
    /// Stage type: Process (transitions on completion) or Escalation (transitions on timeout)
    /// </summary>
    public StageType StageType { get; set; } = StageType.Process;
    
    /// <summary>
    /// Transition policy: OnComplete, OnTimeout, or Manual
    /// </summary>
    public TransitionPolicy TransitionPolicy { get; set; } = TransitionPolicy.OnComplete;
    
    /// <summary>
    /// Timeout in minutes for escalation stages (required if TransitionPolicy is OnTimeout)
    /// </summary>
    public int? TimeoutMinutes { get; set; }
    
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public Workflow Workflow { get; set; } = null!;
    public Team Team { get; set; } = null!;
    public ICollection<Task> Tasks { get; set; } = new List<Task>();
}

