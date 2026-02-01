using Microsoft.EntityFrameworkCore;
using Workload.API.Data;
using Workload.API.Models;

namespace Workload.API.Repositories;

public class WorkloadRepository : Repository<Models.Workload>, IWorkloadRepository
{
    public WorkloadRepository(WorkloadDbContext context) : base(context)
    {
    }

    public async System.Threading.Tasks.Task<Models.Workload?> GetLatestByMemberIdAsync(int memberId)
    {
        return await _context.Workloads
            .Where(w => w.MemberId == memberId)
            .OrderByDescending(w => w.CalculatedAt)
            .FirstOrDefaultAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Workload>> GetWorkloadHistoryByMemberIdAsync(int memberId, int days = 30)
    {
        var cutoffDate = DateTime.UtcNow.AddDays(-days);
        return await _context.Workloads
            .Where(w => w.MemberId == memberId && w.CalculatedAt >= cutoffDate)
            .OrderByDescending(w => w.CalculatedAt)
            .ToListAsync();
    }
}

