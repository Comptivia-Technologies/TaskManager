using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Enums;
using Microsoft.Extensions.Logging;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskCompletedEvent
/// Marks task as completed when all stages are done
/// </summary>
public class TaskCompletedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ITaskService _taskService;
    private readonly ILogger<TaskCompletedEventHandler> _logger;

    public TaskCompletedEventHandler(
        ITaskRepository repository,
        ITaskService taskService,
        ILogger<TaskCompletedEventHandler> logger)
    {
        _repository = repository;
        _taskService = taskService;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskCompletedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskCompletedEvent. TaskId: {TaskId}, WorkflowId: {WorkflowId}, FinalStageId: {FinalStageId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.WorkflowId, @event.FinalStageId, correlationId);

            // Idempotency check
            var existingTask = await _repository.GetByEventIdAsync("TaskCompletedEvent", @event.TaskId);
            if (existingTask != null && existingTask.TaskCompletedEventId == @event.TaskId)
            {
                _logger.LogWarning(
                    "TaskCompletedEvent already processed. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskCompletedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // Update task to completed status
            task.Status = DomainTaskStatus.Completed;
            task.CurrentStageId = @event.FinalStageId;
            task.TaskCompletedEventId = @event.TaskId; // Store for idempotency
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            await _taskService.SyncTaskStatusToWorkflowManagementAsync(@event.TaskId);

            _logger.LogInformation(
                "Task marked as completed. TaskId: {TaskId}, WorkflowId: {WorkflowId}, FinalStageId: {FinalStageId}",
                task.TaskId, @event.WorkflowId, @event.FinalStageId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskCompletedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

