using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface ITaskAuditRepository
{
    Task<TaskAuditEntry?> GetByEventIdAsync(Guid eventId);
    Task<IEnumerable<TaskAuditEntry>> GetByTaskIdAsync(Guid taskId);
    Task<TaskAuditEntry> AddAsync(TaskAuditEntry entry);
}
