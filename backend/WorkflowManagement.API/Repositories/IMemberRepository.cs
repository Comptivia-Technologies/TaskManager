using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface IMemberRepository : IRepository<Member>
{
    Task<IEnumerable<Member>> GetMembersByTeamAsync(int teamId);
    Task<IEnumerable<Member>> GetMembersWithTeamAsync();
}

