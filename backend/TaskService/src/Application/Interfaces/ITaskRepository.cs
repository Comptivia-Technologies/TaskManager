using TaskService.Domain.Entities;
using DomainTask = TaskService.Domain.Entities.Task;

namespace TaskService.Application.Interfaces;

/// <summary>
/// Repository interface for Task entity
/// </summary>
public interface ITaskRepository
{
    System.Threading.Tasks.Task<DomainTask?> GetByIdAsync(Guid taskId);
    System.Threading.Tasks.Task<DomainTask?> GetByEventIdAsync(string eventType, Guid eventId);
    System.Threading.Tasks.Task<DomainTask> CreateAsync(DomainTask task);
    System.Threading.Tasks.Task<DomainTask> UpdateAsync(DomainTask task);
    System.Threading.Tasks.Task<bool> DeleteAsync(Guid taskId);
    System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetOverdueTasksAsync();
    System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetAlreadyOverdueTasksAsync();
    System.Threading.Tasks.Task<IEnumerable<string>> GetAllTaskNamesAsync();
    System.Threading.Tasks.Task<bool> ExistsAsync(Guid taskId);
}

