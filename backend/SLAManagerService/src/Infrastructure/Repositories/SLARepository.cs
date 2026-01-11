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
        _context.SLAAssignments.Add(assignment);
        await _context.SaveChangesAsync();
        return assignment;
    }

    public async Task<SLAAssignment> UpdateAsync(SLAAssignment assignment)
    {
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
        return await _context.SLAAssignments
            .Where(s => !s.IsOverdue && s.SLADeadline > DateTime.UtcNow)
            .ToListAsync();
    }
}

