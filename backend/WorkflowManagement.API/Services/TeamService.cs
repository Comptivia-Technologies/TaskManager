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
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public TeamService(ITeamRepository teamRepository, ApplicationDbContext context, IMapper mapper)
    {
        _teamRepository = teamRepository;
        _context = context;
        _mapper = mapper;
    }

    public async Task<IEnumerable<TeamReadDto>> GetAllTeamsAsync()
    {
        var teams = await _teamRepository.GetAllAsync();
        var teamDtos = _mapper.Map<IEnumerable<TeamReadDto>>(teams).ToList();
        var teamIds = teamDtos.Select(t => t.TeamId).ToList();

        if (teamIds.Any())
        {
            var stages = await _context.Stages
                .Where(s => teamIds.Contains(s.TeamId))
                .Include(s => s.Workflow)
                .ToListAsync();

            var workflowsByTeam = stages
                .Where(s => s.Workflow != null)
                .GroupBy(s => s.TeamId)
                .Select(g => new { TeamId = g.Key, WorkflowNames = g.Select(s => s.Workflow!.WorkflowName).Distinct().ToList() })
                .ToDictionary(w => w.TeamId, w => w.WorkflowNames);

            foreach (var teamDto in teamDtos)
            {
                teamDto.WorkflowNames = workflowsByTeam.TryGetValue(teamDto.TeamId, out var names)
                    ? names
                    : new List<string>();
            }
        }

        return teamDtos;
    }

    public async Task<TeamReadDto?> GetTeamByIdAsync(Guid id)
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

    public async Task<TeamReadDto?> UpdateTeamAsync(Guid id, TeamUpdateDto teamUpdateDto)
    {
        var team = await _teamRepository.GetByIdAsync(id);
        if (team == null) return null;

        _mapper.Map(teamUpdateDto, team);
        if (team.CreatedAt.Kind == DateTimeKind.Unspecified)
            team.CreatedAt = DateTime.SpecifyKind(team.CreatedAt, DateTimeKind.Utc);
        else if (team.CreatedAt.Kind != DateTimeKind.Utc)
            team.CreatedAt = team.CreatedAt.ToUniversalTime();
        team.UpdatedAt = DateTime.UtcNow;

        var updatedTeam = await _teamRepository.UpdateAsync(team);
        return _mapper.Map<TeamReadDto>(updatedTeam);
    }

    public async System.Threading.Tasks.Task<bool> DeleteTeamAsync(Guid id)
    {
        var team = await _teamRepository.GetByIdAsync(id);
        if (team == null) return false;

        var teamWithDeps = await _teamRepository.GetTeamWithMembersAndWorkflowsAsync(id);
        var membersCount = teamWithDeps?.Members?.Count ?? 0;
        var workflowsCount = teamWithDeps?.Workflows?.Count ?? 0;
        var stagesCount = await _context.Stages.CountAsync(s => s.TeamId == id);

        if (membersCount > 0 || workflowsCount > 0 || stagesCount > 0)
        {
            var errors = new List<string>();
            if (membersCount > 0) errors.Add($"{membersCount} member(s)");
            if (workflowsCount > 0) errors.Add($"{workflowsCount} workflow(s)");
            if (stagesCount > 0) errors.Add($"{stagesCount} stage(s)");
            throw new InvalidOperationException(
                $"Cannot delete team. It is currently assigned to: {string.Join(", ", errors)}.");
        }

        return await _teamRepository.DeleteAsync(id);
    }

    public async Task<IEnumerable<MemberReadDto>> GetTeamMembersAsync(Guid teamId)
    {
        var team = await _teamRepository.GetTeamWithMembersAsync(teamId);
        if (team == null) return Enumerable.Empty<MemberReadDto>();
        return _mapper.Map<IEnumerable<MemberReadDto>>(team.Members);
    }

    public async Task<IEnumerable<WorkflowReadDto>> GetTeamWorkflowsAsync(Guid teamId)
    {
        var team = await _teamRepository.GetTeamWithWorkflowsAsync(teamId);
        var directWorkflows = team?.Workflows ?? Enumerable.Empty<Workflow>();

        var workflowsFromStages = await _context.Stages
            .Where(s => s.TeamId == teamId)
            .Include(s => s.Workflow)
            .Where(s => s.Workflow != null)
            .Select(s => s.Workflow!)
            .Distinct()
            .ToListAsync();

        var allWorkflows = directWorkflows
            .Concat(workflowsFromStages)
            .GroupBy(w => w.WorkflowId)
            .Select(g => g.First())
            .ToList();

        return _mapper.Map<IEnumerable<WorkflowReadDto>>(allWorkflows);
    }
}
