using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public class WorkflowRepository : Repository<Workflow>, IWorkflowRepository
{
    public WorkflowRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<Workflow?> GetWorkflowWithStagesAsync(Guid workflowId)
    {
        return await _context.Workflows
            .Include(w => w.Stages)
            .OrderBy(w => w.WorkflowId)
            .FirstOrDefaultAsync(w => w.WorkflowId == workflowId);
    }

    public async Task<Workflow?> GetWorkflowWithTasksAsync(Guid workflowId)
    {
        return await _context.Workflows
            .Include(w => w.Tasks)
                .ThenInclude(t => t.AssignedToMember)
            .Include(w => w.Tasks)
                .ThenInclude(t => t.Stage)
            .FirstOrDefaultAsync(w => w.WorkflowId == workflowId);
    }

    public async Task<Workflow?> GetWorkflowWithStagesAndTasksAsync(Guid workflowId)
    {
        var workflow = await _context.Workflows
            .Include(w => w.Team)
            .Include(w => w.Stages)
            .Include(w => w.Tasks)
                .ThenInclude(t => t.AssignedToMember)
            .Include(w => w.Tasks)
                .ThenInclude(t => t.Stage)
            .FirstOrDefaultAsync(w => w.WorkflowId == workflowId);

        if (workflow != null && workflow.Stages.Any())
        {
            workflow.Stages = workflow.Stages.OrderBy(s => s.StageOrder).ToList();
        }

        return workflow;
    }

    public async Task<IEnumerable<Workflow>> GetWorkflowsByTeamAsync(Guid teamId)
    {
        return await _context.Workflows
            .Include(w => w.Team)
            .Where(w => w.TeamId == teamId)
            .ToListAsync();
    }

    public async Task<IEnumerable<Workflow>> GetWorkflowsByOrganizationAsync(Guid organizationId)
    {
        return await _context.Workflows
            .Include(w => w.Team)
            .Include(w => w.Stages)
            .Where(w => w.OrganizationId == organizationId)
            .ToListAsync();
    }
}

