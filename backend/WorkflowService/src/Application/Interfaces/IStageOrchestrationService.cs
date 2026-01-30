using Shared.Contracts.EventContracts;

namespace WorkflowService.Application.Interfaces;

/// <summary>
/// Service for orchestrating stage transitions in workflows
/// </summary>
public interface IStageOrchestrationService
{
    /// <summary>
    /// Starts a task in the first stage of its workflow
    /// </summary>
    Task StartTaskInFirstStageAsync(TaskAssignedEvent taskAssignedEvent);
    
    /// <summary>
    /// Handles stage completion and transitions to next stage
    /// </summary>
    Task HandleStageCompletionAsync(TaskStageCompletedEvent stageCompletedEvent);
    
    /// <summary>
    /// Handles escalation timeout and transitions to next stage
    /// </summary>
    Task HandleEscalationTimeoutAsync(TaskStageEscalationTriggeredEvent escalationEvent);
}

