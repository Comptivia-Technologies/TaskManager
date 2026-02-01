using Microsoft.EntityFrameworkCore;
using SLAConfiguration.API.Data;
using SLAConfiguration.API.Models;

namespace SLAConfiguration.API.Repositories;

public class SLARepository : Repository<Models.SLAConfiguration>, ISLARepository
{
    public SLARepository(SLAConfigurationDbContext context) : base(context)
    {
    }

    public async Task<Models.SLAConfiguration?> GetByWorkflowIdAsync(int workflowId)
    {
        return await _context.SLAConfigurations
            .FirstOrDefaultAsync(s => s.WorkflowId == workflowId);
    }

    public async Task<bool> ExistsForWorkflowAsync(int workflowId)
    {
        return await _context.SLAConfigurations
            .AnyAsync(s => s.WorkflowId == workflowId);
    }
}

