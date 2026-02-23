using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface IMemberRepository : IRepository<Member>
{
    Task<IEnumerable<Member>> GetMembersByTeamAsync(Guid teamId);
    Task<IEnumerable<Member>> GetMembersWithTeamAsync();
    Task<IEnumerable<Member>> GetMembersWithTeamByOrganizationAsync(Guid organizationId);
    Task<IEnumerable<Member>> GetMembersByTeamAsync(Guid teamId, Guid organizationId);
}

