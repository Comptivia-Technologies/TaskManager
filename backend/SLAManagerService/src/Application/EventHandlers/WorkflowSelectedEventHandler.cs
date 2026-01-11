using Shared.Contracts.EventContracts;
using SLAManagerService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace SLAManagerService.Application.EventHandlers;

/// <summary>
/// Event handler for WorkflowSelectedEvent
/// Configures SLA for the task
/// </summary>
public class WorkflowSelectedEventHandler
{
    private readonly ISLAService _slaService;
    private readonly ILogger<WorkflowSelectedEventHandler> _logger;

    public WorkflowSelectedEventHandler(
        ISLAService slaService,
        ILogger<WorkflowSelectedEventHandler> logger)
    {
        _slaService = slaService;
        _logger = logger;
    }

    public async Task HandleAsync(WorkflowSelectedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received WorkflowSelectedEvent. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.WorkflowId, correlationId);

            await _slaService.ConfigureSLAForTaskAsync(@event);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling WorkflowSelectedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

