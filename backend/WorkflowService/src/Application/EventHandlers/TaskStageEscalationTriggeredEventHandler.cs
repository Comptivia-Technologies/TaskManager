using Shared.Contracts.EventContracts;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.EventHandlers;

/// <summary>
/// Handles TaskStageEscalationTriggeredEvent - transitions to next stage on timeout
/// </summary>
public class TaskStageEscalationTriggeredEventHandler
{
    private readonly IStageOrchestrationService _stageOrchestrationService;
    private readonly ILogger<TaskStageEscalationTriggeredEventHandler> _logger;

    public TaskStageEscalationTriggeredEventHandler(
        IStageOrchestrationService stageOrchestrationService,
        ILogger<TaskStageEscalationTriggeredEventHandler> logger)
    {
        _stageOrchestrationService = stageOrchestrationService;
        _logger = logger;
    }

    public async Task HandleAsync(TaskStageEscalationTriggeredEvent eventData, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Handling TaskStageEscalationTriggeredEvent. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, NextStageId: {NextStageId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, eventData.CurrentStageId, eventData.NextStageId, correlationId);

            // Handle escalation timeout and transition
            await _stageOrchestrationService.HandleEscalationTimeoutAsync(eventData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageEscalationTriggeredEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, correlationId);
            throw;
        }
    }
}

