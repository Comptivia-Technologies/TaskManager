using Shared.Contracts.EventContracts;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.EventHandlers;

/// <summary>
/// Starts the stage a task was returned to and restores the previous assignee.
/// </summary>
public class TaskStageReturnedEventHandler
{
    private readonly IStageOrchestrationService _stageOrchestrationService;
    private readonly ILogger<TaskStageReturnedEventHandler> _logger;

    public TaskStageReturnedEventHandler(
        IStageOrchestrationService stageOrchestrationService,
        ILogger<TaskStageReturnedEventHandler> logger)
    {
        _stageOrchestrationService = stageOrchestrationService;
        _logger = logger;
    }

    public async Task HandleAsync(TaskStageReturnedEvent eventData, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Handling TaskStageReturnedEvent. TaskId: {TaskId}, ToStageId: {ToStageId}, ToMemberId: {ToMemberId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, eventData.ToStageId, eventData.ToMemberId, correlationId);

            await _stageOrchestrationService.HandleStageReturnedAsync(eventData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageReturnedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, correlationId);
            throw;
        }
    }
}
