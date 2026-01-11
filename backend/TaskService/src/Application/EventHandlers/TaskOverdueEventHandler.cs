using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Enums;
using Microsoft.Extensions.Logging;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskOverdueEvent
/// Marks task as overdue
/// </summary>
public class TaskOverdueEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<TaskOverdueEventHandler> _logger;

    public TaskOverdueEventHandler(
        ITaskRepository repository,
        ILogger<TaskOverdueEventHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskOverdueEvent @event, Guid correlationId)
    {
        try
        {
            // Idempotency check
            var existingTask = await _repository.GetByEventIdAsync("TaskOverdueEvent", @event.TaskId);
            if (existingTask != null && existingTask.TaskOverdueEventId == @event.TaskId)
            {
                _logger.LogWarning(
                    "TaskOverdueEvent already processed. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskOverdueEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // Mark task as overdue
            task.IsOverdue = true;
            task.Status = DomainTaskStatus.Overdue;
            task.TaskOverdueEventId = @event.TaskId; // Store event ID for idempotency
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogWarning(
                "Task marked as overdue. TaskId: {TaskId}, MinutesOverdue: {MinutesOverdue}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.MinutesOverdue, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskOverdueEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

