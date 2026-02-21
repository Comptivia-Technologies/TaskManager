using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface ITaskService
{
    Task<TaskReadDto> CreateTaskAsync(TaskCreateDto taskCreateDto);
    Task<IEnumerable<TaskReadDto>> GetAllTasksAsync();
    Task<TaskReadDto?> GetTaskByIdAsync(Guid id);
    Task<TaskReadDto?> UpdateTaskAsync(Guid id, TaskUpdateDto taskUpdateDto);
    Task<bool> DeleteTaskAsync(Guid id);
    Task<IEnumerable<TaskReadDto>> GetTasksByWorkflowAsync(Guid workflowId);
    Task<IEnumerable<TaskReadDto>> GetTasksByStageAsync(Guid stageId);
    Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(Guid memberId);
}



