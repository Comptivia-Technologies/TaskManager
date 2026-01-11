using Shared.Contracts.EventContracts;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskCreatedEvent
/// Automatically selects workflow for the task
/// </summary>
public class TaskCreatedEventHandler
{
    private readonly IWorkflowSelectionService _selectionService;
    private readonly ILogger<TaskCreatedEventHandler> _logger;

    public TaskCreatedEventHandler(
        IWorkflowSelectionService selectionService,
        ILogger<TaskCreatedEventHandler> logger)
    {
        _selectionService = selectionService;
        _logger = logger;
    }

    public async Task HandleAsync(TaskCreatedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskCreatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);

            await _selectionService.SelectWorkflowForTaskAsync(@event);
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

