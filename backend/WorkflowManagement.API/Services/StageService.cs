using AutoMapper;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;

namespace WorkflowManagement.API.Services;

public class StageService : IStageService
{
    private readonly IStageRepository _stageRepository;
    private readonly IWorkflowRepository _workflowRepository;
    private readonly ITeamRepository _teamRepository;
    private readonly IWorkflowService _workflowService;
    private readonly IMapper _mapper;

    public StageService(IStageRepository stageRepository, IWorkflowRepository workflowRepository, ITeamRepository teamRepository, IWorkflowService workflowService, IMapper mapper)
    {
        _stageRepository = stageRepository;
        _workflowRepository = workflowRepository;
        _teamRepository = teamRepository;
        _workflowService = workflowService;
        _mapper = mapper;
    }

    public async Task<IEnumerable<StageReadDto>> GetAllStagesAsync()
    {
        var stages = await _stageRepository.GetStagesWithTeamAsync();
        return _mapper.Map<IEnumerable<StageReadDto>>(stages);
    }

    public async Task<StageReadDto?> GetStageByIdAsync(Guid id)
    {
        var stage = await _stageRepository.GetByIdAsync(id);
        return stage == null ? null : _mapper.Map<StageReadDto>(stage);
    }

    public async Task<StageReadDto> CreateStageAsync(StageCreateDto stageCreateDto)
    {
        var workflow = await _workflowRepository.GetByIdAsync(stageCreateDto.WorkflowId);
        if (workflow == null)
            throw new ArgumentException("Workflow does not exist.");
        var team = await _teamRepository.GetByIdAsync(stageCreateDto.TeamId);
        if (team == null)
            throw new ArgumentException("Team does not exist.");

        var stage = _mapper.Map<Stage>(stageCreateDto);
        stage.CreatedAt = DateTime.UtcNow;

        var createdStage = await _stageRepository.AddAsync(stage);
        var stageWithTeam = await _stageRepository.GetStageWithTeamAsync(createdStage.StageId);
        if (stageWithTeam == null)
            throw new InvalidOperationException("Failed to retrieve created stage");

        var stageDto = _mapper.Map<StageReadDto>(stageWithTeam);
        if (stageWithTeam.Team != null)
            stageDto.TeamName = stageWithTeam.Team.TeamName;

        try { await _workflowService.UpdateWorkflowJsonAsync(stageCreateDto.WorkflowId); } catch { }

        return stageDto;
    }

    public async Task<StageReadDto?> UpdateStageAsync(Guid id, StageUpdateDto stageUpdateDto)
    {
        var stage = await _stageRepository.GetByIdAsync(id);
        if (stage == null) return null;

        var workflowId = stage.WorkflowId;
        _mapper.Map(stageUpdateDto, stage);
        var updatedStage = await _stageRepository.UpdateAsync(stage);

        try { await _workflowService.UpdateWorkflowJsonAsync(workflowId); } catch { }

        return _mapper.Map<StageReadDto>(updatedStage);
    }

    public async Task<bool> DeleteStageAsync(Guid id)
    {
        var stage = await _stageRepository.GetByIdAsync(id);
        if (stage == null) return false;

        var workflowId = stage.WorkflowId;
        var deleted = await _stageRepository.DeleteAsync(id);
        if (deleted)
        {
            try { await _workflowService.UpdateWorkflowJsonAsync(workflowId); } catch { }
        }
        return deleted;
    }

    public async Task<IEnumerable<StageReadDto>> GetStagesByWorkflowAsync(Guid workflowId)
    {
        var stages = await _stageRepository.GetStagesByWorkflowAsync(workflowId);
        return _mapper.Map<IEnumerable<StageReadDto>>(stages);
    }
}
