using Shared.Contracts.EventContracts;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.EventHandlers;

/// <summary>
/// Handles TaskAssignedEvent - starts task in first stage
/// </summary>
public class TaskAssignedEventHandler
{
    private readonly IStageOrchestrationService _stageOrchestrationService;
    private readonly ILogger<TaskAssignedEventHandler> _logger;

    public TaskAssignedEventHandler(
        IStageOrchestrationService stageOrchestrationService,
        ILogger<TaskAssignedEventHandler> logger)
    {
        _stageOrchestrationService = stageOrchestrationService;
        _logger = logger;
    }

    public async Task HandleAsync(TaskAssignedEvent eventData, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Handling TaskAssignedEvent. TaskId: {TaskId}, MemberId: {MemberId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, eventData.MemberId, correlationId);

            // Start task in first stage
            await _stageOrchestrationService.StartTaskInFirstStageAsync(eventData);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskAssignedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, correlationId);
            throw;
        }
    }
}

