using TaskService.Domain.Entities;

namespace TaskService.Application.Interfaces;

public interface ITaskStageDataRepository
{
    System.Threading.Tasks.Task AppendAsync(TaskStageData entry);
    System.Threading.Tasks.Task<IReadOnlyList<TaskStageData>> GetByTaskIdAsync(Guid taskId);
    System.Threading.Tasks.Task<IReadOnlyList<TaskStageData>> GetLatestPerStageAsync(Guid taskId);
}
