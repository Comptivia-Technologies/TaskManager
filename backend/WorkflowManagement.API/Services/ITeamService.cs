using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface ITeamService
{
    Task<IEnumerable<TeamReadDto>> GetAllTeamsAsync();
    Task<TeamReadDto?> GetTeamByIdAsync(int id);
    Task<TeamReadDto> CreateTeamAsync(TeamCreateDto teamCreateDto);
    Task<TeamReadDto?> UpdateTeamAsync(int id, TeamUpdateDto teamUpdateDto);
    System.Threading.Tasks.Task<bool> DeleteTeamAsync(int id);
    Task<IEnumerable<MemberReadDto>> GetTeamMembersAsync(int teamId);
    Task<IEnumerable<WorkflowReadDto>> GetTeamWorkflowsAsync(int teamId);
}



