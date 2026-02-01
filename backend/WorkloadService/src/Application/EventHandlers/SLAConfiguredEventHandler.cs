using Shared.Contracts.EventContracts;
using WorkloadService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkloadService.Application.EventHandlers;

/// <summary>
/// Event handler for SLAConfiguredEvent
/// Assigns task to best available member
/// </summary>
public class SLAConfiguredEventHandler
{
    private readonly IWorkloadEvaluationService _evaluationService;
    private readonly ILogger<SLAConfiguredEventHandler> _logger;

    public SLAConfiguredEventHandler(
        IWorkloadEvaluationService evaluationService,
        ILogger<SLAConfiguredEventHandler> logger)
    {
        _evaluationService = evaluationService;
        _logger = logger;
    }

    public async Task HandleAsync(SLAConfiguredEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received SLAConfiguredEvent. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.WorkflowId, correlationId);

            await _evaluationService.AssignTaskToBestMemberAsync(@event);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling SLAConfiguredEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

