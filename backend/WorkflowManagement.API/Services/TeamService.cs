using AutoMapper;
using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;
using WorkflowManagement.API.Data;

namespace WorkflowManagement.API.Services;

public class TeamService : ITeamService
{
    private readonly ITeamRepository _teamRepository;
    private readonly IStageRepository _stageRepository;
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public TeamService(ITeamRepository teamRepository, IStageRepository stageRepository, ApplicationDbContext context, IMapper mapper)
    {
        _teamRepository = teamRepository;
        _stageRepository = stageRepository;
        _context = context;
        _mapper = mapper;
    }

    public async Task<IEnumerable<TeamReadDto>> GetAllTeamsAsync()
    {
        var teams = await _teamRepository.GetAllAsync();
        return _mapper.Map<IEnumerable<TeamReadDto>>(teams);
    }

    public async Task<TeamReadDto?> GetTeamByIdAsync(int id)
    {
        var team = await _teamRepository.GetByIdAsync(id);
        return team == null ? null : _mapper.Map<TeamReadDto>(team);
    }

    public async Task<TeamReadDto> CreateTeamAsync(TeamCreateDto teamCreateDto)
    {
        var team = _mapper.Map<Team>(teamCreateDto);
        team.CreatedAt = DateTime.UtcNow;
        team.UpdatedAt = DateTime.UtcNow;

        var createdTeam = await _teamRepository.AddAsync(team);
        return _mapper.Map<TeamReadDto>(createdTeam);
    }

    public async Task<TeamReadDto?> UpdateTeamAsync(int id, TeamUpdateDto teamUpdateDto)
    {
        var team = await _teamRepository.GetByIdAsync(id);
        if (team == null)
            return null;

        _mapper.Map(teamUpdateDto, team);
        team.UpdatedAt = DateTime.UtcNow;

        var updatedTeam = await _teamRepository.UpdateAsync(team);
        return _mapper.Map<TeamReadDto>(updatedTeam);
    }

    public async System.Threading.Tasks.Task<bool> DeleteTeamAsync(int id)
    {
        var team = await _teamRepository.GetByIdAsync(id);
        if (team == null)
            return false;

        // Check for dependencies
        var teamWithDeps = await _teamRepository.GetTeamWithMembersAndWorkflowsAsync(id);
        var membersCount = teamWithDeps?.Members?.Count ?? 0;
        var workflowsCount = teamWithDeps?.Workflows?.Count ?? 0;
        
        // Check for stages using this team
        var stagesCount = await _context.Stages.CountAsync(s => s.TeamId == id);

        // Build error message if dependencies exist
        if (membersCount > 0 || workflowsCount > 0 || stagesCount > 0)
        {
            var errors = new List<string>();
            if (membersCount > 0)
                errors.Add($"{membersCount} member(s)");
            if (workflowsCount > 0)
                errors.Add($"{workflowsCount} workflow(s)");
            if (stagesCount > 0)
                errors.Add($"{stagesCount} stage(s)");

            var errorMessage = $"Cannot delete team. It is currently assigned to: {string.Join(", ", errors)}. " +
                             "Please remove or reassign these dependencies before deleting the team.";
            throw new InvalidOperationException(errorMessage);
        }

        return await _teamRepository.DeleteAsync(id);
    }

    public async Task<IEnumerable<MemberReadDto>> GetTeamMembersAsync(int teamId)
    {
        var team = await _teamRepository.GetTeamWithMembersAsync(teamId);
        if (team == null)
            return Enumerable.Empty<MemberReadDto>();

        return _mapper.Map<IEnumerable<MemberReadDto>>(team.Members);
    }

    public async Task<IEnumerable<WorkflowReadDto>> GetTeamWorkflowsAsync(int teamId)
    {
        var team = await _teamRepository.GetTeamWithWorkflowsAsync(teamId);
        if (team == null)
            return Enumerable.Empty<WorkflowReadDto>();

        return _mapper.Map<IEnumerable<WorkflowReadDto>>(team.Workflows);
    }
}



