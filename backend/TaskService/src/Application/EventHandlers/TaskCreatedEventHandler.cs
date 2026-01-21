using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Domain.Enums;
using Microsoft.Extensions.Logging;
using DomainTask = TaskService.Domain.Entities.Task;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskCreatedEvent
/// Creates the task in TaskService database when API Gateway publishes the event
/// </summary>
public class TaskCreatedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<TaskCreatedEventHandler> _logger;

    public TaskCreatedEventHandler(
        ITaskRepository repository,
        ILogger<TaskCreatedEventHandler> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskCreatedEvent @event, Guid correlationId)
    {
        try
        {
            // Idempotency check - see if task already exists
            var existingTask = await _repository.GetByIdAsync(@event.TaskId);
            if (existingTask != null)
            {
                _logger.LogWarning(
                    "Task already exists. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // Create task from event
            // Use default priority "Medium" if not assigned by rule engine
            var priority = string.IsNullOrEmpty(@event.Priority) ? "Medium" : @event.Priority;
            
            var task = new DomainTask
            {
                TaskId = @event.TaskId,
                TaskName = @event.TaskName,
                Description = @event.Description,
                Priority = priority,
                TaskType = @event.TaskType,
                Status = DomainTaskStatus.Created,
                CreatedAt = @event.CreatedAt,
                UpdatedAt = @event.CreatedAt
            };

            await _repository.CreateAsync(task);

            _logger.LogInformation(
                "Task created from TaskCreatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskCreatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

