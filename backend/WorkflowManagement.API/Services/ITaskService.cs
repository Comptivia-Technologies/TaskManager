using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface ITaskService
{
    Task<IEnumerable<TaskReadDto>> GetAllTasksAsync();
    Task<TaskReadDto?> GetTaskByIdAsync(int id);
    Task<TaskReadDto> CreateTaskAsync(TaskCreateDto taskCreateDto);
    Task<TaskReadDto?> UpdateTaskAsync(int id, TaskUpdateDto taskUpdateDto);
    Task<bool> DeleteTaskAsync(int id);
    Task<IEnumerable<TaskReadDto>> GetTasksByWorkflowAsync(int workflowId);
    Task<IEnumerable<TaskReadDto>> GetTasksByStageAsync(int stageId);
    Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(int memberId);
}



