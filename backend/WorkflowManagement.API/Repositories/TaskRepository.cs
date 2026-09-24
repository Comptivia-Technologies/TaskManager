using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public class TaskRepository : Repository<Models.Task>, ITaskRepository
{
    public TaskRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async System.Threading.Tasks.Task<Models.Task?> GetTaskWithDetailsAsync(Guid taskId, Guid organizationId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .FirstOrDefaultAsync(t => t.TaskId == taskId && t.OrganizationId == organizationId);
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByWorkflowAsync(Guid workflowId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.WorkflowId == workflowId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByStageAsync(Guid stageId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.StageId == stageId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByMemberAsync(Guid memberId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.AssignedToMemberId == memberId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksCompletedByMemberAsync(Guid memberId)
    {
        var memberIdStr = memberId.ToString();
        var tasks = await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.CompletedByMemberIds != null)
            .ToListAsync();
        return tasks.Where(t => ("," + t.CompletedByMemberIds + ",").Contains("," + memberIdStr + ",")).ToList();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksEscalatedByMemberAsync(Guid memberId)
    {
        var memberIdStr = memberId.ToString();
        var tasks = await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.EscalatedByMemberIds != null)
            .ToListAsync();
        return tasks.Where(t => ("," + t.EscalatedByMemberIds + ",").Contains("," + memberIdStr + ",")).ToList();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksWithDetailsAsync()
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksWithDetailsByOrganizationAsync(Guid organizationId)
    {
        return await _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.OrganizationId == organizationId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<(IEnumerable<Models.Task> Items, int TotalCount)> GetTasksWithDetailsByOrganizationPaginatedAsync(Guid organizationId, string? priority, int page, int limit)
    {
        var query = _context.Tasks
            .Include(t => t.Workflow)
            .Include(t => t.Stage)
            .Include(t => t.AssignedToMember)
            .Where(t => t.OrganizationId == organizationId);

        if (!string.IsNullOrWhiteSpace(priority))
            query = query.Where(t => t.Priority == priority.Trim());

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync();

        return (items, totalCount);
    }
}

