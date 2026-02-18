using Shared.Contracts.EventContracts;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.EventHandlers;

/// <summary>
/// Handles TaskStageEscalatedEvent - transitions to next stage on manual escalation
/// </summary>
public class TaskStageEscalatedEventHandler
{
    private readonly IStageOrchestrationService _stageOrchestrationService;
    private readonly ILogger<TaskStageEscalatedEventHandler> _logger;

    public TaskStageEscalatedEventHandler(
        IStageOrchestrationService stageOrchestrationService,
        ILogger<TaskStageEscalatedEventHandler> logger)
    {
        _stageOrchestrationService = stageOrchestrationService;
        _logger = logger;
    }

    public async Task HandleAsync(TaskStageEscalatedEvent eventData, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Handling TaskStageEscalatedEvent. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, NextStageId: {NextStageId}, Reason: {Reason}, CorrelationId: {CorrelationId}",
                eventData.TaskId, eventData.CurrentStageId, eventData.NextStageId, eventData.EscalationReason, correlationId);

            // Convert TaskStageEscalatedEvent to TaskStageCompletedEvent for orchestration
            // The orchestration logic is the same - just move to next stage
            var stageCompletedEvent = new TaskStageCompletedEvent
            {
                TaskId = eventData.TaskId,
                StageId = eventData.CurrentStageId,
                StageName = eventData.CurrentStageName,
                WorkflowId = eventData.WorkflowId,
                NextStageId = eventData.NextStageId,
                NextStageName = eventData.NextStageName,
                CompletedAt = eventData.EscalatedAt,
                CorrelationId = correlationId
            };

            // Handle escalation using the same stage completion logic
            await _stageOrchestrationService.HandleStageCompletionAsync(stageCompletedEvent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageEscalatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                eventData.TaskId, correlationId);
            throw;
        }
    }
}
