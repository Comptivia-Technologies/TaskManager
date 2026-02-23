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
    private readonly ICurrentOrganizationAccessor _orgAccessor;
    private readonly IMapper _mapper;

    public TeamService(ITeamRepository teamRepository, IStageRepository stageRepository, ApplicationDbContext context, ICurrentOrganizationAccessor orgAccessor, IMapper mapper)
    {
        _teamRepository = teamRepository;
        _stageRepository = stageRepository;
        _context = context;
        _orgAccessor = orgAccessor;
        _mapper = mapper;
    }

    public async Task<IEnumerable<TeamReadDto>> GetAllTeamsAsync()
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var teams = await _teamRepository.GetTeamsByOrganizationAsync(orgId.Value);
        var teamDtos = _mapper.Map<IEnumerable<TeamReadDto>>(teams).ToList();
        
        // Get all team IDs
        var teamIds = teamDtos.Select(t => t.TeamId).ToList();
        
        if (teamIds.Any())
        {
            var stages = await _context.Stages
                .Where(s => teamIds.Contains(s.TeamId) && s.OrganizationId == orgId.Value)
                .Include(s => s.Workflow)
                .ToListAsync();
            
            // Group by team and get distinct workflow names
            var workflowsByTeam = stages
                .Where(s => s.Workflow != null)
                .GroupBy(s => s.TeamId)
                .Select(g => new
                {
                    TeamId = g.Key,
                    WorkflowNames = g.Select(s => s.Workflow!.WorkflowName).Distinct().ToList()
                })
                .ToDictionary(w => w.TeamId, w => w.WorkflowNames);
            
            // Map workflow names to teams
            foreach (var teamDto in teamDtos)
            {
                if (workflowsByTeam.TryGetValue(teamDto.TeamId, out var workflowNames))
                {
                    teamDto.WorkflowNames = workflowNames;
                }
                else
                {
                    teamDto.WorkflowNames = new List<string>();
                }
            }
        }
        
        return teamDtos;
    }

    public async Task<TeamReadDto?> GetTeamByIdAsync(Guid id)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var team = await _teamRepository.GetByIdAsync(id);
        if (team == null || team.OrganizationId != orgId.Value)
            return null;
        return _mapper.Map<TeamReadDto>(team);
    }

    public async Task<TeamReadDto> CreateTeamAsync(TeamCreateDto teamCreateDto)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var team = _mapper.Map<Team>(teamCreateDto);
        team.OrganizationId = orgId.Value;
        team.CreatedAt = DateTime.UtcNow;
        team.UpdatedAt = DateTime.UtcNow;

        var createdTeam = await _teamRepository.AddAsync(team);
        return _mapper.Map<TeamReadDto>(createdTeam);
    }

    public async Task<TeamReadDto?> UpdateTeamAsync(Guid id, TeamUpdateDto teamUpdateDto)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var team = await _teamRepository.GetByIdAsync(id);
        if (team == null || team.OrganizationId != orgId.Value)
            return null;

        _mapper.Map(teamUpdateDto, team);
        // Ensure CreatedAt is UTC (PostgreSQL requires UTC for timestamp with time zone)
        if (team.CreatedAt.Kind == DateTimeKind.Unspecified)
        {
            team.CreatedAt = DateTime.SpecifyKind(team.CreatedAt, DateTimeKind.Utc);
        }
        else if (team.CreatedAt.Kind != DateTimeKind.Utc)
        {
            team.CreatedAt = team.CreatedAt.ToUniversalTime();
        }
        team.UpdatedAt = DateTime.UtcNow;

        var updatedTeam = await _teamRepository.UpdateAsync(team);
        return _mapper.Map<TeamReadDto>(updatedTeam);
    }

    public async System.Threading.Tasks.Task<bool> DeleteTeamAsync(Guid id)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var team = await _teamRepository.GetByIdAsync(id);
        if (team == null || team.OrganizationId != orgId.Value)
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

    public async Task<IEnumerable<MemberReadDto>> GetTeamMembersAsync(Guid teamId)
    {
        var team = await _teamRepository.GetTeamWithMembersAsync(teamId);
        if (team == null)
            return Enumerable.Empty<MemberReadDto>();

        return _mapper.Map<IEnumerable<MemberReadDto>>(team.Members);
    }

    public async Task<IEnumerable<WorkflowReadDto>> GetTeamWorkflowsAsync(Guid teamId)
    {
        // Get workflows directly assigned to the team (via TeamId on Workflow)
        var team = await _teamRepository.GetTeamWithWorkflowsAsync(teamId);
        var directWorkflows = team?.Workflows ?? Enumerable.Empty<Workflow>();
        
        // Get workflows that have stages assigned to this team
        var workflowsFromStages = await _context.Stages
            .Where(s => s.TeamId == teamId)
            .Include(s => s.Workflow)
            .Where(s => s.Workflow != null)
            .Select(s => s.Workflow!)
            .Distinct()
            .ToListAsync();
        
        // Combine both sets of workflows and remove duplicates
        var allWorkflows = directWorkflows
            .Concat(workflowsFromStages)
            .GroupBy(w => w.WorkflowId)
            .Select(g => g.First())
            .ToList();
        
        return _mapper.Map<IEnumerable<WorkflowReadDto>>(allWorkflows);
    }
}



