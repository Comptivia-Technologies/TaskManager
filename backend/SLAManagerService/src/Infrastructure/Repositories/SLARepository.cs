using Microsoft.EntityFrameworkCore;
using SLAManagerService.Application.Interfaces;
using SLAManagerService.Domain.Entities;
using SLAManagerService.Infrastructure.Persistence;

namespace SLAManagerService.Infrastructure.Repositories;

/// <summary>
/// Repository implementation for SLA operations
/// </summary>
public class SLARepository : ISLARepository
{
    private readonly SLADbContext _context;

    public SLARepository(SLADbContext context)
    {
        _context = context;
    }

    public async Task<SLAAssignment?> GetByTaskIdAsync(Guid taskId)
    {
        return await _context.SLAAssignments
            .FirstOrDefaultAsync(s => s.TaskId == taskId);
    }

    public async Task<SLAAssignment> CreateAsync(SLAAssignment assignment)
    {
        // Ensure all DateTime values are UTC (PostgreSQL requires UTC for timestamp with time zone)
        if (assignment.SLAStartTime.Kind != DateTimeKind.Utc)
        {
            assignment.SLAStartTime = assignment.SLAStartTime.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(assignment.SLAStartTime, DateTimeKind.Utc)
                : assignment.SLAStartTime.ToUniversalTime();
        }
        
        if (assignment.SLADeadline.Kind != DateTimeKind.Utc)
        {
            assignment.SLADeadline = assignment.SLADeadline.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(assignment.SLADeadline, DateTimeKind.Utc)
                : assignment.SLADeadline.ToUniversalTime();
        }
        
        if (assignment.CreatedAt.Kind != DateTimeKind.Utc)
        {
            assignment.CreatedAt = assignment.CreatedAt.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(assignment.CreatedAt, DateTimeKind.Utc)
                : assignment.CreatedAt.ToUniversalTime();
        }

        _context.SLAAssignments.Add(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    public async Task<SLAAssignment> UpdateAsync(SLAAssignment assignment)
    {
        // Ensure all DateTime values are UTC (PostgreSQL requires UTC for timestamp with time zone)
        if (assignment.SLAStartTime.Kind != DateTimeKind.Utc)
        {
            assignment.SLAStartTime = assignment.SLAStartTime.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(assignment.SLAStartTime, DateTimeKind.Utc)
                : assignment.SLAStartTime.ToUniversalTime();
        }
        
        if (assignment.SLADeadline.Kind != DateTimeKind.Utc)
        {
            assignment.SLADeadline = assignment.SLADeadline.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(assignment.SLADeadline, DateTimeKind.Utc)
                : assignment.SLADeadline.ToUniversalTime();
        }
        
        if (assignment.CreatedAt.Kind != DateTimeKind.Utc)
        {
            assignment.CreatedAt = assignment.CreatedAt.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(assignment.CreatedAt, DateTimeKind.Utc)
                : assignment.CreatedAt.ToUniversalTime();
        }

        _context.SLAAssignments.Update(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    public async Task<SLAConfiguration?> GetSLAConfigurationByWorkflowIdAsync(int workflowId)
    {
        return await _context.SLAConfigurations
            .FirstOrDefaultAsync(s => s.WorkflowId == workflowId);
    }

    public async Task<IEnumerable<SLAAssignment>> GetActiveSLAAssignmentsAsync()
    {
        // Remove the deadline filter - we need to check ALL not-yet-overdue tasks
        // The SLAMonitorService will check if deadline has passed
        // This is now a fallback mechanism since delayed messages handle most cases
        var assignments = await _context.SLAAssignments
            .Where(s => !s.IsOverdue)  // Only get tasks not yet marked as overdue
            .ToListAsync();
        
        // Ensure all DateTime values are UTC (PostgreSQL TIMESTAMP without timezone can be loaded as Unspecified)
        foreach (var assignment in assignments)
        {
            if (assignment.SLAStartTime.Kind == DateTimeKind.Unspecified)
            {
                assignment.SLAStartTime = DateTime.SpecifyKind(assignment.SLAStartTime, DateTimeKind.Utc);
            }
            if (assignment.SLADeadline.Kind == DateTimeKind.Unspecified)
            {
                assignment.SLADeadline = DateTime.SpecifyKind(assignment.SLADeadline, DateTimeKind.Utc);
            }
            if (assignment.CreatedAt.Kind == DateTimeKind.Unspecified)
            {
                assignment.CreatedAt = DateTime.SpecifyKind(assignment.CreatedAt, DateTimeKind.Utc);
            }
        }
        
        return assignments;
    }
}

