using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IStageService
{
    Task<IEnumerable<StageReadDto>> GetAllStagesAsync();
    Task<StageReadDto?> GetStageByIdAsync(Guid id);
    Task<StageReadDto> CreateStageAsync(StageCreateDto stageCreateDto);
    Task<StageReadDto?> UpdateStageAsync(Guid id, StageUpdateDto stageUpdateDto);
    Task<bool> DeleteStageAsync(Guid id);
    Task<IEnumerable<StageReadDto>> GetStagesByWorkflowAsync(Guid workflowId);
}



