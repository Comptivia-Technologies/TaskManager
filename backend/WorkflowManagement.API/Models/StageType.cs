namespace WorkflowManagement.API.Models;

/// <summary>
/// Stage type determines workflow behavior
/// </summary>
public enum StageType
{
    /// <summary>
    /// Process workflow: ERP-style, transitions on completion
    /// </summary>
    Process = 0,
    
    /// <summary>
    /// Escalation workflow: Ticketing-style, transitions on timeout
    /// </summary>
    Escalation = 1
}

