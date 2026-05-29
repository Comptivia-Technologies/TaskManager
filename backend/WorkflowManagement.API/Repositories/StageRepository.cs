using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public class StageRepository : Repository<Stage>, IStageRepository
{
    public StageRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Stage>> GetStagesByWorkflowAsync(Guid workflowId)
    {
        return await _context.Stages
            .Include(s => s.Workflow)
            .Include(s => s.Team)
            .Where(s => s.WorkflowId == workflowId)
            .OrderBy(s => s.StageOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<Stage>> GetStagesWithTeamAsync()
    {
        return await _context.Stages
            .Include(s => s.Workflow)
            .Include(s => s.Team)
            .ToListAsync();
    }

    public async Task<Stage?> GetStageWithTeamAsync(Guid stageId)
    {
        return await _context.Stages
            .Include(s => s.Workflow)
            .Include(s => s.Team)
            .FirstOrDefaultAsync(s => s.StageId == stageId);
    }

}

