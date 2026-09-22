using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Records a return in the stage history. Stage movement is handled by WorkflowService.
/// </summary>
public class TaskStageReturnedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ITaskStageHistoryRepository _historyRepository;
    private readonly ILogger<TaskStageReturnedEventHandler> _logger;

    public TaskStageReturnedEventHandler(
        ITaskRepository repository,
        ITaskStageHistoryRepository historyRepository,
        ILogger<TaskStageReturnedEventHandler> logger)
    {
        _repository = repository;
        _historyRepository = historyRepository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskStageReturnedEvent @event, Guid correlationId)
    {
        try
        {
            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskStageReturnedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            await _historyRepository.AppendAsync(new TaskStageHistory
            {
                OrganizationId = task.OrganizationId,
                TaskId = @event.TaskId,
                Action = TaskStageHistory.Returned,
                StageId = @event.FromStageId,
                StageName = @event.FromStageName,
                StageOrder = @event.FromStageOrder,
                MemberId = @event.ReturnedByMemberId,
                MemberName = @event.ReturnedByMemberName,
                FromStageId = @event.FromStageId,
                FromStageName = @event.FromStageName,
                ToStageId = @event.ToStageId,
                ToStageName = @event.ToStageName,
                Reason = @event.Reason,
                OccurredAt = @event.ReturnedAt,
                CorrelationId = correlationId
            });

            _logger.LogInformation(
                "Recorded stage return. TaskId: {TaskId}, FromStageId: {FromStageId}, ToStageId: {ToStageId}, ToMemberId: {ToMemberId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.FromStageId, @event.ToStageId, @event.ToMemberId, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageReturnedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }
}
