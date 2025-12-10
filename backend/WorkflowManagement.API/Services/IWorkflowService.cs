using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IWorkflowService
{
    System.Threading.Tasks.Task<IEnumerable<WorkflowReadDto>> GetAllWorkflowsAsync();
    System.Threading.Tasks.Task<WorkflowReadDto?> GetWorkflowByIdAsync(int id);
    System.Threading.Tasks.Task<WorkflowReadDto> CreateWorkflowAsync(WorkflowCreateDto workflowCreateDto);
    System.Threading.Tasks.Task<WorkflowReadDto?> UpdateWorkflowAsync(int id, WorkflowUpdateDto workflowUpdateDto);
    System.Threading.Tasks.Task<bool> DeleteWorkflowAsync(int id);
    System.Threading.Tasks.Task<IEnumerable<StageReadDto>> GetWorkflowStagesAsync(int workflowId);
    System.Threading.Tasks.Task<IEnumerable<TaskReadDto>> GetWorkflowTasksAsync(int workflowId);
    System.Threading.Tasks.Task UpdateWorkflowJsonAsync(int workflowId);
}



