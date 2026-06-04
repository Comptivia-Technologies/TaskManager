using TaskService.Application.DTOs;

namespace TaskService.Application.Interfaces;

public interface ITaskAuditRecorder
{
    System.Threading.Tasks.Task TryRecordAsync(Guid taskId, TaskAuditRecordDto record);
}
