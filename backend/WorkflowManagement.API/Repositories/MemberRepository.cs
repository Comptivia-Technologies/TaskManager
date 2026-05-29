using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public class MemberRepository : Repository<Member>, IMemberRepository
{
    public MemberRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Member>> GetMembersByTeamAsync(Guid teamId)
    {
        return await _context.Members
            .Include(m => m.Team)
            .Where(m => m.TeamId == teamId)
            .ToListAsync();
    }

    public async Task<IEnumerable<Member>> GetMembersWithTeamAsync()
    {
        return await _context.Members
            .Include(m => m.Team)
            .ToListAsync();
    }

    public async Task<Member?> GetByEmailAsync(string email)
    {
        return await _context.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Email.ToLower() == email.ToLower());
    }
}
