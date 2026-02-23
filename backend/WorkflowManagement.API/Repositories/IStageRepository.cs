using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface IStageRepository : IRepository<Stage>
{
    Task<IEnumerable<Stage>> GetStagesByWorkflowAsync(Guid workflowId);
    Task<IEnumerable<Stage>> GetStagesWithTeamAsync();
    Task<Stage?> GetStageWithTeamAsync(Guid stageId);
    Task<IEnumerable<Stage>> GetStagesWithTeamByOrganizationAsync(Guid organizationId);
}

