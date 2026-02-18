using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskStageEscalatedEvent
/// Updates task when stage is manually escalated (does NOT update CompletedByMemberIds)
/// </summary>
public class TaskStageEscalatedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<TaskStageEscalatedEventHandler> _logger;

    public TaskStageEscalatedEventHandler(
        ITaskRepository repository,
        ILogger<TaskStageEscalatedEventHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskStageEscalatedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskStageEscalatedEvent. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, NextStageId: {NextStageId}, Reason: {Reason}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.CurrentStageId, @event.NextStageId, @event.EscalationReason, correlationId);

            // Idempotency check - use CorrelationId (unique per event) not TaskId (same for all stage events)
            var existingTask = await _repository.GetByEventIdAsync("TaskStageEscalatedEvent", correlationId);
            if (existingTask != null && existingTask.TaskStageEscalatedEventId == correlationId)
            {
                _logger.LogWarning(
                    "TaskStageEscalatedEvent already processed. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.CurrentStageId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskStageEscalatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // Update task - clear current stage info (will be set by next TaskStageStartedEvent)
            // Only clear CurrentStageId if NextStageId is NULL (last stage escalated)
            // Otherwise, keep CurrentStageId as-is until TaskStageStartedEvent sets it to avoid race conditions
            if (@event.NextStageId.HasValue)
            {
                // Next stage exists - keep CurrentStageId as-is until TaskStageStartedEvent updates it
                // This prevents race condition where CurrentStageId is set before stage actually starts
                // The old stage ID will be replaced when TaskStageStartedEvent processes
                _logger.LogInformation(
                    "Stage escalated, waiting for next stage to start. TaskId: {TaskId}, EscalatedFromStageId: {EscalatedFromStageId}, NextStageId: {NextStageId}, CurrentStageId: {CurrentStageId}, Reason: {Reason}",
                    task.TaskId, @event.CurrentStageId, @event.NextStageId, task.CurrentStageId, @event.EscalationReason);
            }
            else
            {
                // Last stage escalated - clear CurrentStageId
                task.CurrentStageId = null;
                _logger.LogInformation(
                    "Last stage escalated. TaskId: {TaskId}, EscalatedFromStageId: {EscalatedFromStageId}, Reason: {Reason}",
                    task.TaskId, @event.CurrentStageId, @event.EscalationReason);
            }
            
            task.CurrentStageStartedAt = null; // Will be set when next stage starts
            task.StageTimeoutAt = null; // Will be set when next stage starts
            task.TaskStageEscalatedEventId = correlationId; // Store CorrelationId for idempotency (unique per stage event)

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "Task updated after stage escalation. TaskId: {TaskId}, EscalatedFromStageId: {EscalatedFromStageId}, NextStageId: {NextStageId}, Reason: {Reason}, CorrelationId: {CorrelationId}",
                task.TaskId, @event.CurrentStageId, @event.NextStageId, @event.EscalationReason, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageEscalatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}
