using Shared.Contracts.EventContracts;
using SLAManagerService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace SLAManagerService.Application.EventHandlers;

/// <summary>
/// Event handler for PriorityAssignedEvent
/// Configures SLA for the task using the assigned priority
/// </summary>
public class PriorityAssignedEventHandler
{
    private readonly ISLAService _slaService;
    private readonly ILogger<PriorityAssignedEventHandler> _logger;

    public PriorityAssignedEventHandler(
        ISLAService slaService,
        ILogger<PriorityAssignedEventHandler> logger)
    {
        _slaService = slaService;
        _logger = logger;
    }

    public async Task HandleAsync(PriorityAssignedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "=== PriorityAssignedEventHandler START === TaskId: {TaskId}, WorkflowId: {WorkflowId}, Priority: {Priority}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.WorkflowId, @event.Priority, correlationId);

            if (@event.WorkflowId == Guid.Empty)
            {
                _logger.LogError(
                    "❌ Invalid WorkflowId in PriorityAssignedEvent: {WorkflowId}, TaskId: {TaskId}",
                    @event.WorkflowId, @event.TaskId);
            }

            await _slaService.ConfigureSLAForTaskAsync(@event);
            
            _logger.LogInformation(
                "=== PriorityAssignedEventHandler END === TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "❌ ERROR in PriorityAssignedEventHandler. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}, Exception: {Exception}",
                @event.TaskId, @event.WorkflowId, correlationId, ex.ToString());
            throw;
        }
    }
}

