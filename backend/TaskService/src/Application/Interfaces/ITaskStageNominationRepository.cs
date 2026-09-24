using TaskService.Domain.Entities;

namespace TaskService.Application.Interfaces;

public interface ITaskStageNominationRepository
{
    System.Threading.Tasks.Task AddAsync(TaskStageNomination nomination);
    System.Threading.Tasks.Task<TaskStageNomination?> GetForStageAsync(Guid taskId, Guid stageId);
}
