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

    public async System.Threading.Tasks.Task<IEnumerable<Member>> GetMembersByTeamIdAsync(Guid teamId)
    {
        return await _context.Members
            .Where(m => m.TeamId == teamId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetTasksByMemberIdAsync(Guid memberId)
    {
        return await _context.Tasks
            .Where(t => t.AssignedToMemberId == memberId)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<TaskAssignment?> GetAssignmentByTaskIdAsync(Guid taskId)
    {
        return await _context.TaskAssignments
            .Where(ta => ta.TaskId == taskId && ta.EndedAt == null)
            .OrderByDescending(ta => ta.AssignedAt)
            .FirstOrDefaultAsync();
    }

    public async System.Threading.Tasks.Task<TaskAssignment?> GetAssignmentByCorrelationIdAsync(Guid correlationId)
    {
        return await _context.TaskAssignments
            .FirstOrDefaultAsync(ta => ta.CorrelationId == correlationId);
    }

    public async System.Threading.Tasks.Task<TaskAssignment> CreateAssignmentAsync(TaskAssignment assignment)
    {
        NormalizeTimestamps(assignment);
        _context.TaskAssignments.Add(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    public async System.Threading.Tasks.Task<TaskAssignment> UpdateAssignmentAsync(TaskAssignment assignment)
    {
        NormalizeTimestamps(assignment);
        _context.TaskAssignments.Update(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    /// <summary>
    /// AssignedAt loaded from "timestamp without time zone" comes back as Unspecified.
    /// Npgsql rejects that when the column is written as timestamptz.
    /// </summary>
    private static void NormalizeTimestamps(TaskAssignment assignment)
    {
        assignment.AssignedAt = AsUtc(assignment.AssignedAt);
        if (assignment.EndedAt.HasValue)
            assignment.EndedAt = AsUtc(assignment.EndedAt.Value);
    }

    private static DateTime AsUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    public async System.Threading.Tasks.Task<Workflow?> GetWorkflowByIdAsync(Guid workflowId)
    {
        return await _context.Workflows
            .FirstOrDefaultAsync(w => w.WorkflowId == workflowId);
    }

    public async System.Threading.Tasks.Task<IEnumerable<DomainStage>> GetStagesByWorkflowIdAsync(Guid workflowId)
    {
        return await _context.Stages
            .Where(s => s.WorkflowId == workflowId)
            .OrderBy(s => s.StageOrder)
            .ToListAsync();
    }
}

