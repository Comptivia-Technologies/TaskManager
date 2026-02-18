using TaskService.Application.DTOs;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.Interfaces;

/// <summary>
/// Service interface for task operations
/// </summary>
public interface ITaskService
{
    System.Threading.Tasks.Task<TaskReadDto> CreateTaskAsync(TaskCreateDto createDto);
    System.Threading.Tasks.Task<TaskReadDto?> GetTaskByIdAsync(Guid taskId);
    System.Threading.Tasks.Task UpdateTaskStatusAsync(Guid taskId, DomainTaskStatus newStatus);
    System.Threading.Tasks.Task<bool> DeleteTaskAsync(Guid taskId);
    System.Threading.Tasks.Task SyncAllOverdueTasksAsync();
    System.Threading.Tasks.Task CleanupOrphanedTasksAsync();
    System.Threading.Tasks.Task CompleteCurrentStageAsync(Guid taskId);
    System.Threading.Tasks.Task EscalateStageAsync(Guid taskId, string escalationReason);
}

