using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskStageCompletedEvent
/// Updates task when a stage is completed
/// </summary>
public class TaskStageCompletedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<TaskStageCompletedEventHandler> _logger;

    public TaskStageCompletedEventHandler(
        ITaskRepository repository,
        ILogger<TaskStageCompletedEventHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskStageCompletedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskStageCompletedEvent. TaskId: {TaskId}, StageId: {StageId}, NextStageId: {NextStageId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.StageId, @event.NextStageId, correlationId);

            // Idempotency check - use CorrelationId (unique per event) not TaskId (same for all stage events)
            var existingTask = await _repository.GetByEventIdAsync("TaskStageCompletedEvent", correlationId);
            if (existingTask != null && existingTask.TaskStageCompletedEventId == correlationId)
            {
                _logger.LogWarning(
                    "TaskStageCompletedEvent already processed. TaskId: {TaskId}, StageId: {StageId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.StageId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskStageCompletedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // Update task - clear current stage info (will be set by next TaskStageStartedEvent)
            task.CurrentStageId = @event.NextStageId; // Will be updated when next stage starts
            task.CurrentStageStartedAt = null; // Will be set when next stage starts
            task.StageTimeoutAt = null; // Will be set when next stage starts
            task.TaskStageCompletedEventId = correlationId; // Store CorrelationId for idempotency (unique per stage event)
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "Task updated after stage completion. TaskId: {TaskId}, CompletedStageId: {CompletedStageId}, NextStageId: {NextStageId}",
                task.TaskId, @event.StageId, @event.NextStageId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageCompletedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

