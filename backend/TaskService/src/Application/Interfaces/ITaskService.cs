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
    /// <summary>
    /// Pushes the task's current status from TaskService to WorkflowManagement.API (same as after UpdateTaskStatusAsync).
    /// </summary>
    System.Threading.Tasks.Task SyncTaskStatusToWorkflowManagementAsync(Guid taskId);
    System.Threading.Tasks.Task<bool> DeleteTaskAsync(Guid taskId);
    System.Threading.Tasks.Task SyncAllOverdueTasksAsync();
    System.Threading.Tasks.Task CleanupOrphanedTasksAsync();
    System.Threading.Tasks.Task CompleteCurrentStageAsync(Guid taskId);
    System.Threading.Tasks.Task CompleteCurrentStageAsync(Guid taskId, Dictionary<string, object>? stageData);
    System.Threading.Tasks.Task CompleteCurrentStageAsync(Guid taskId, Dictionary<string, object>? stageData, Guid? nextStageMemberId);
    System.Threading.Tasks.Task CompleteCurrentStageAsync(Guid taskId, Dictionary<string, object>? stageData, Guid? nextStageMemberId, Dictionary<string, Guid>? stageNominations);
    System.Threading.Tasks.Task ReturnToStageAsync(Guid taskId, Guid targetStageId, string reason);
    System.Threading.Tasks.Task<IReadOnlyList<TaskStageHistoryReadDto>> GetStageHistoryAsync(Guid taskId);
    System.Threading.Tasks.Task<IReadOnlyList<TaskStageDataReadDto>> GetStageDataAsync(Guid taskId);
    System.Threading.Tasks.Task EscalateStageAsync(Guid taskId, string escalationReason);
    System.Threading.Tasks.Task SyncAllTasksFromWorkflowManagementAsync();
}

