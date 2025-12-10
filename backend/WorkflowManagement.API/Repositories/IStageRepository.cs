using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface IStageRepository : IRepository<Stage>
{
    Task<IEnumerable<Stage>> GetStagesByWorkflowAsync(int workflowId);
    Task<IEnumerable<Stage>> GetStagesWithTeamAsync();
    Task<Stage?> GetStageWithTeamAsync(int stageId);
}

