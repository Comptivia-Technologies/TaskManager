using Shared.Contracts.EventContracts;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.EventHandlers;

/// <summary>
/// Handles TaskStageCompletedEvent - transitions to next stage or completes task
/// </summary>
public class TaskStageCompletedEventHandler
{
    private readonly IStageOrchestrationService _stageOrchestrationService;
    private readonly ILogger<TaskStageCompletedEventHandler> _logger;

    public TaskStageCompletedEventHandler(
        IStageOrchestrationService stageOrchestrationService,
        ILogger<TaskStageCompletedEventHandler> logger)
    {
        _stageOrchestrationService = stageOrchestrationService;
        _logger = logger;
    }

    public async Task HandleAsync(TaskStageCompletedEvent eventData, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Handling TaskStageCompletedEvent. TaskId: {TaskId}, StageId: {StageId}, NextStageId: {NextStageId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, eventData.StageId, eventData.NextStageId, correlationId);

            // Handle stage completion and transition
            await _stageOrchestrationService.HandleStageCompletionAsync(eventData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageCompletedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, correlationId);
            throw;
        }
    }
}

