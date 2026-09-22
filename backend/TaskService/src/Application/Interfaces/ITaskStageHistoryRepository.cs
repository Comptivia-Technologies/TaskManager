using TaskService.Domain.Entities;

namespace TaskService.Application.Interfaces;

public interface ITaskStageHistoryRepository
{
    System.Threading.Tasks.Task AppendAsync(TaskStageHistory entry);
    System.Threading.Tasks.Task<IReadOnlyList<TaskStageHistory>> GetByTaskIdAsync(Guid taskId);
    System.Threading.Tasks.Task<TaskStageHistory?> GetLastAssignmentAsync(Guid taskId, Guid stageId);
}
