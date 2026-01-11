using Microsoft.EntityFrameworkCore;
using WorkflowService.Application.Interfaces;
using WorkflowService.Domain.Entities;
using WorkflowService.Infrastructure.Persistence;

namespace WorkflowService.Infrastructure.Repositories;

/// <summary>
/// Repository implementation for workflow operations
/// </summary>
public class WorkflowRepository : IWorkflowRepository
{
    private readonly WorkflowDbContext _context;

    public WorkflowRepository(WorkflowDbContext context)
    {
        _context = context;
    }

    public async Task<WorkflowSelection?> GetByTaskIdAsync(Guid taskId)
    {
        return await _context.WorkflowSelections
            .FirstOrDefaultAsync(ws => ws.TaskId == taskId);
    }

    public async Task<WorkflowSelection> CreateAsync(WorkflowSelection selection)
    {
        _context.WorkflowSelections.Add(selection);
        await _context.SaveChangesAsync();
        return selection;
    }

    public async Task<IEnumerable<Workflow>> GetAllWorkflowsAsync()
    {
        return await _context.Workflows.ToListAsync();
    }

    public async Task<Workflow?> GetWorkflowByIdAsync(int workflowId)
    {
        return await _context.Workflows
            .FirstOrDefaultAsync(w => w.WorkflowId == workflowId);
    }
}

