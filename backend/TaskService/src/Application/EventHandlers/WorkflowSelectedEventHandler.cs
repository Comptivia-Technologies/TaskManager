using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Enums;
using Microsoft.Extensions.Logging;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for WorkflowSelectedEvent
/// Updates task with workflow information
/// </summary>
public class WorkflowSelectedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<WorkflowSelectedEventHandler> _logger;

    public WorkflowSelectedEventHandler(
        ITaskRepository repository,
        ILogger<WorkflowSelectedEventHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(WorkflowSelectedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received WorkflowSelectedEvent. TaskId: {TaskId}, SelectionId: {SelectionId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.SelectionId, @event.WorkflowId, correlationId);

            // Idempotency check - use SelectionId instead of TaskId
            var existingTask = await _repository.GetByEventIdAsync("WorkflowSelectedEvent", @event.SelectionId);
            if (existingTask != null && existingTask.WorkflowSelectedEventId == @event.SelectionId)
            {
                _logger.LogWarning(
                    "WorkflowSelectedEvent already processed. TaskId: {TaskId}, SelectionId: {SelectionId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.SelectionId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for WorkflowSelectedEvent. TaskId: {TaskId}, SelectionId: {SelectionId}, CorrelationId: {CorrelationId}. Will retry later.",
                    @event.TaskId, @event.SelectionId, correlationId);
                // Don't throw - task might be created later, EventBus will retry
                return;
            }

            // Update task with workflow information
            task.WorkflowId = @event.WorkflowId;
            task.Status = DomainTaskStatus.WorkflowSelected;
            
            // Validate SelectionId is not empty
            if (@event.SelectionId == Guid.Empty)
            {
                _logger.LogError(
                    "WorkflowSelectedEvent has empty SelectionId. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                throw new InvalidOperationException("WorkflowSelectedEvent.SelectionId cannot be empty");
            }
            
            task.WorkflowSelectedEventId = @event.SelectionId; // Store SelectionId for idempotency
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "Task workflow assigned. TaskId: {TaskId}, WorkflowId: {WorkflowId}, WorkflowName: {WorkflowName}, SelectionId: {SelectionId}, CorrelationId: {CorrelationId}. Task updated in database.",
                @event.TaskId, @event.WorkflowId, @event.WorkflowName, @event.SelectionId, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling WorkflowSelectedEvent. TaskId: {TaskId}, SelectionId: {SelectionId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.SelectionId, correlationId);
            throw;
        }
    }
}

