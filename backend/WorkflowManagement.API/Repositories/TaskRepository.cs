using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public class TaskRepository : Repository<Models.Task>, ITaskRepository
{
    public TaskRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByWorkflowAsync(int workflowId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.WorkflowId == workflowId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByStageAsync(int stageId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.StageId == stageId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByMemberAsync(int memberId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.AssignedToMemberId == memberId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksWithDetailsAsync()
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .ToListAsync();
    }
}

