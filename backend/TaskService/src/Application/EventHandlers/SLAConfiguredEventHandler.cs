using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Enums;
using Microsoft.Extensions.Logging;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for SLAConfiguredEvent
/// Updates task with SLA information
/// </summary>
public class SLAConfiguredEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<SLAConfiguredEventHandler> _logger;

    public SLAConfiguredEventHandler(
        ITaskRepository repository,
        ILogger<SLAConfiguredEventHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(SLAConfiguredEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received SLAConfiguredEvent. TaskId: {TaskId}, SLAAssignmentId: {SLAAssignmentId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.SLAAssignmentId, @event.WorkflowId, correlationId);

            // Idempotency check - use SLAAssignmentId instead of TaskId
            var existingTask = await _repository.GetByEventIdAsync("SLAConfiguredEvent", @event.SLAAssignmentId);
            if (existingTask != null && existingTask.SLAConfiguredEventId == @event.SLAAssignmentId)
            {
                _logger.LogWarning(
                    "SLAConfiguredEvent already processed. TaskId: {TaskId}, SLAAssignmentId: {SLAAssignmentId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.SLAAssignmentId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for SLAConfiguredEvent. TaskId: {TaskId}, SLAAssignmentId: {SLAAssignmentId}, CorrelationId: {CorrelationId}. Will retry later.",
                    @event.TaskId, @event.SLAAssignmentId, correlationId);
                // Don't throw - task might be created later, EventBus will retry
                return;
            }

            // Update task with SLA information
            // Preserve WorkflowId if already set (from WorkflowSelectedEvent)
            if (!task.WorkflowId.HasValue)
            {
                task.WorkflowId = @event.WorkflowId;
            }
            task.SLAConfigurationId = @event.WorkflowId; // Store workflow ID as SLA config reference
            task.SLAStartTime = @event.SLAStartTime;
            task.SLADeadline = @event.SLADeadline;
            task.Status = DomainTaskStatus.SLAConfigured;
            task.SLAConfiguredEventId = @event.SLAAssignmentId; // Store SLAAssignmentId for idempotency
            // Preserve WorkflowSelectedEventId if already set (don't overwrite)
            // WorkflowSelectedEventId is set by WorkflowSelectedEventHandler
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "Task SLA configured. TaskId: {TaskId}, WorkflowId: {WorkflowId}, Priority: {Priority}, ResponseTimeMinutes: {ResponseTimeMinutes}, Deadline: {Deadline}, StartTime: {StartTime}, SLAAssignmentId: {SLAAssignmentId}, CorrelationId: {CorrelationId}. Task updated in database.",
                @event.TaskId, @event.WorkflowId, @event.Priority, @event.ResponseTimeMinutes, @event.SLADeadline, @event.SLAStartTime, @event.SLAAssignmentId, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling SLAConfiguredEvent. TaskId: {TaskId}, SLAAssignmentId: {SLAAssignmentId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.SLAAssignmentId, correlationId);
            throw;
        }
    }
}

