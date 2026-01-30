using Microsoft.EntityFrameworkCore;
using WorkloadService.Application.Interfaces;
using WorkloadService.Domain.Entities;
using WorkloadService.Infrastructure.Persistence;
using DomainTask = WorkloadService.Domain.Entities.Task;
using DomainStage = WorkloadService.Domain.Entities.Stage;

namespace WorkloadService.Infrastructure.Repositories;

/// <summary>
/// Repository implementation for workload operations
/// </summary>
public class WorkloadRepository : IWorkloadRepository
{
    private readonly WorkloadDbContext _context;

    public WorkloadRepository(WorkloadDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task<IEnumerable<Member>> GetAllMembersAsync()
    {
        return await _context.Members.ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Member>> GetMembersByTeamIdAsync(int teamId)
    {
        return await _context.Members
            .Where(m => m.TeamId == teamId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetTasksByMemberIdAsync(int memberId)
    {
        return await _context.Tasks
            .Where(t => t.AssignedToMemberId == memberId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<TaskAssignment?> GetAssignmentByTaskIdAsync(Guid taskId)
    {
        return await _context.TaskAssignments
            .FirstOrDefaultAsync(ta => ta.TaskId == taskId);
    }

    public async System.Threading.Tasks.Task<TaskAssignment> CreateAssignmentAsync(TaskAssignment assignment)
    {
        _context.TaskAssignments.Add(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    public async System.Threading.Tasks.Task<TaskAssignment> UpdateAssignmentAsync(TaskAssignment assignment)
    {
        _context.TaskAssignments.Update(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    public async System.Threading.Tasks.Task<Workflow?> GetWorkflowByIdAsync(int workflowId)
    {
        return await _context.Workflows
            .FirstOrDefaultAsync(w => w.WorkflowId == workflowId);
    }

    public async System.Threading.Tasks.Task<IEnumerable<DomainStage>> GetStagesByWorkflowIdAsync(int workflowId)
    {
        return await _context.Stages
            .Where(s => s.WorkflowId == workflowId)
            .OrderBy(s => s.StageOrder)
            .ToListAsync();
    }
}

