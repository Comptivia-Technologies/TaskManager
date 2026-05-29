using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface IMemberRepository : IRepository<Member>
{
    Task<IEnumerable<Member>> GetMembersByTeamAsync(Guid teamId);
    Task<IEnumerable<Member>> GetMembersWithTeamAsync();
    Task<Member?> GetByEmailAsync(string email);
}
