using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public class TaskAuditRepository : ITaskAuditRepository
{
    private readonly ApplicationDbContext _context;

    public TaskAuditRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<TaskAuditEntry?> GetByEventIdAsync(Guid eventId)
    {
        return await _context.TaskAuditEntries
            .FirstOrDefaultAsync(e => e.EventId == eventId);
    }

    public async Task<IEnumerable<TaskAuditEntry>> GetByTaskIdAsync(Guid taskId)
    {
        return await _context.TaskAuditEntries
            .Where(e => e.TaskId == taskId)
            .OrderBy(e => e.OccurredAt)
            .ThenBy(e => e.AuditId)
            .ToListAsync();
    }

    public async Task<TaskAuditEntry> AddAsync(TaskAuditEntry entry)
    {
        if (entry.OccurredAt.Kind != DateTimeKind.Utc)
            entry.OccurredAt = entry.OccurredAt.ToUniversalTime();

        await _context.TaskAuditEntries.AddAsync(entry);
        await _context.SaveChangesAsync();
        return entry;
    }
}
