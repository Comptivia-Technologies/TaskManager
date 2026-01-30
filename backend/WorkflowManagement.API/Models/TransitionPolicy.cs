namespace WorkflowManagement.API.Models;

/// <summary>
/// Defines how a stage transitions to the next stage
/// </summary>
public enum TransitionPolicy
{
    /// <summary>
    /// Move to next stage when current stage is manually completed
    /// </summary>
    OnComplete = 0,
    
    /// <summary>
    /// Auto-escalate to next stage when timeout is reached
    /// </summary>
    OnTimeout = 1,
    
    /// <summary>
    /// Manual transition required (no automatic transition)
    /// </summary>
    Manual = 2
}

