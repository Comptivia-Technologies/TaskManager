using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IWorkflowService
{
    System.Threading.Tasks.Task<IEnumerable<WorkflowReadDto>> GetAllWorkflowsAsync();
    System.Threading.Tasks.Task<WorkflowReadDto?> GetWorkflowByIdAsync(Guid id);
    System.Threading.Tasks.Task<WorkflowReadDto> CreateWorkflowAsync(WorkflowCreateDto workflowCreateDto);
    System.Threading.Tasks.Task<WorkflowReadDto?> UpdateWorkflowAsync(Guid id, WorkflowUpdateDto workflowUpdateDto);
    System.Threading.Tasks.Task<bool> DeleteWorkflowAsync(Guid id);
    System.Threading.Tasks.Task<IEnumerable<StageReadDto>> GetWorkflowStagesAsync(Guid workflowId);
    System.Threading.Tasks.Task<IEnumerable<TaskReadDto>> GetWorkflowTasksAsync(Guid workflowId);
    System.Threading.Tasks.Task UpdateWorkflowJsonAsync(Guid workflowId);
}



