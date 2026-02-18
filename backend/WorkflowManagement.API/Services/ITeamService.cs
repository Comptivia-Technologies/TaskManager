using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface ITeamService
{
    Task<IEnumerable<TeamReadDto>> GetAllTeamsAsync();
    Task<TeamReadDto?> GetTeamByIdAsync(Guid id);
    Task<TeamReadDto> CreateTeamAsync(TeamCreateDto teamCreateDto);
    Task<TeamReadDto?> UpdateTeamAsync(Guid id, TeamUpdateDto teamUpdateDto);
    System.Threading.Tasks.Task<bool> DeleteTeamAsync(Guid id);
    Task<IEnumerable<MemberReadDto>> GetTeamMembersAsync(Guid teamId);
    Task<IEnumerable<WorkflowReadDto>> GetTeamWorkflowsAsync(Guid teamId);
}



