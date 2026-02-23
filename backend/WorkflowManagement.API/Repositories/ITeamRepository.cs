using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface ITeamRepository : IRepository<Team>
{
    Task<Team?> GetTeamWithMembersAsync(Guid teamId);
    Task<Team?> GetTeamWithWorkflowsAsync(Guid teamId);
    Task<Team?> GetTeamWithMembersAndWorkflowsAsync(Guid teamId);
    Task<IEnumerable<Team>> GetTeamsByOrganizationAsync(Guid organizationId);
}


