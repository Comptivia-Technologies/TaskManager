using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public class TeamRepository : Repository<Team>, ITeamRepository
{
    public TeamRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<Team?> GetTeamWithMembersAsync(Guid teamId)
    {
        return await _context.Teams
            .Include(t => t.Members)
            .FirstOrDefaultAsync(t => t.TeamId == teamId);
    }

    public async Task<Team?> GetTeamWithWorkflowsAsync(Guid teamId)
    {
        return await _context.Teams
            .Include(t => t.Workflows)
            .FirstOrDefaultAsync(t => t.TeamId == teamId);
    }

    public async Task<Team?> GetTeamWithMembersAndWorkflowsAsync(Guid teamId)
    {
        return await _context.Teams
            .Include(t => t.Members)
            .Include(t => t.Workflows)
            .FirstOrDefaultAsync(t => t.TeamId == teamId);
    }

    public async Task<IEnumerable<Team>> GetTeamsByOrganizationAsync(Guid organizationId)
    {
        return await _context.Teams
            .Where(t => t.OrganizationId == organizationId)
            .ToListAsync();
    }
}


