using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskStageEscalationTriggeredEvent
/// Updates task when escalation timeout triggers
/// </summary>
public class TaskStageEscalationTriggeredEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<TaskStageEscalationTriggeredEventHandler> _logger;

    public TaskStageEscalationTriggeredEventHandler(
        ITaskRepository repository,
        ILogger<TaskStageEscalationTriggeredEventHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskStageEscalationTriggeredEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskStageEscalationTriggeredEvent. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, NextStageId: {NextStageId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.CurrentStageId, @event.NextStageId, correlationId);

            // Idempotency check - use CorrelationId (unique per event) not TaskId (same for all stage events)
            var existingTask = await _repository.GetByEventIdAsync("TaskStageEscalationTriggeredEvent", correlationId);
            if (existingTask != null && existingTask.TaskStageEscalationTriggeredEventId == correlationId)
            {
                _logger.LogWarning(
                    "TaskStageEscalationTriggeredEvent already processed. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.CurrentStageId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskStageEscalationTriggeredEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // Update task - clear current stage info (will be set by next TaskStageStartedEvent)
            // Clear CurrentStageId immediately when escalation timeout triggers to allow next stage to start
            task.CurrentStageId = null; // Always clear - next TaskStageStartedEvent will set it
            task.CurrentStageStartedAt = null; // Will be set when next stage starts
            task.StageTimeoutAt = null; // Will be set when next stage starts
            task.TaskStageEscalationTriggeredEventId = correlationId; // Store CorrelationId for idempotency (unique per stage event)
            task.UpdatedAt = DateTime.UtcNow;

            if (@event.NextStageId.HasValue)
            {
                _logger.LogInformation(
                    "Stage escalation timeout triggered, cleared CurrentStageId for next stage. TaskId: {TaskId}, EscalatedFromStageId: {EscalatedFromStageId}, NextStageId: {NextStageId}",
                    task.TaskId, @event.CurrentStageId, @event.NextStageId);
            }
            else
            {
                _logger.LogInformation(
                    "Last stage escalation timeout triggered. TaskId: {TaskId}, EscalatedFromStageId: {EscalatedFromStageId}",
                    task.TaskId, @event.CurrentStageId);
            }

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "Task updated after escalation. TaskId: {TaskId}, EscalatedFromStageId: {EscalatedFromStageId}, NextStageId: {NextStageId}",
                task.TaskId, @event.CurrentStageId, @event.NextStageId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageEscalationTriggeredEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

