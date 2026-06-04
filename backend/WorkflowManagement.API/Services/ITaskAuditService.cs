using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface ITaskAuditService
{
    Task<IEnumerable<TaskAuditEntryReadDto>> GetAuditByTaskIdAsync(Guid taskId);
    Task<TaskAuditEntryReadDto?> RecordAuditEntryAsync(Guid taskId, TaskAuditEntryCreateDto dto);
}
