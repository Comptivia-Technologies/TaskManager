using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IStageService
{
    Task<IEnumerable<StageReadDto>> GetAllStagesAsync();
    Task<StageReadDto?> GetStageByIdAsync(int id);
    Task<StageReadDto> CreateStageAsync(StageCreateDto stageCreateDto);
    Task<StageReadDto?> UpdateStageAsync(int id, StageUpdateDto stageUpdateDto);
    Task<bool> DeleteStageAsync(int id);
    Task<IEnumerable<StageReadDto>> GetStagesByWorkflowAsync(int workflowId);
}



