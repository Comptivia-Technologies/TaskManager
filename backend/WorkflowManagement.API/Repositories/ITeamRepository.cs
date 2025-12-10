using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface ITeamRepository : IRepository<Team>
{
    Task<Team?> GetTeamWithMembersAsync(int teamId);
    Task<Team?> GetTeamWithWorkflowsAsync(int teamId);
    Task<Team?> GetTeamWithMembersAndWorkflowsAsync(int teamId);
}


