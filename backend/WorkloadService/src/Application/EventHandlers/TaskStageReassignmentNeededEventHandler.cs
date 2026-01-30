using Shared.Contracts.EventContracts;
using WorkloadService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkloadService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskStageReassignmentNeededEvent
/// Reassigns task to the best available member in the new stage's team
/// </summary>
public class TaskStageReassignmentNeededEventHandler
{
    private readonly IWorkloadEvaluationService _evaluationService;
    private readonly ILogger<TaskStageReassignmentNeededEventHandler> _logger;

    public TaskStageReassignmentNeededEventHandler(
        IWorkloadEvaluationService evaluationService,
        ILogger<TaskStageReassignmentNeededEventHandler> logger)
    {
        _evaluationService = evaluationService;
        _logger = logger;
    }

    public async Task HandleAsync(TaskStageReassignmentNeededEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskStageReassignmentNeededEvent. TaskId: {TaskId}, NewTeamId: {NewTeamId}, StageName: {StageName}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.NewTeamId, @event.StageName, correlationId);

            await _evaluationService.ReassignTaskToTeamMemberAsync(@event);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageReassignmentNeededEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}

