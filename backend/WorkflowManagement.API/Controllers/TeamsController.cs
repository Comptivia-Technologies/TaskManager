using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.Authorization;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TeamsController : ControllerBase
{
    private readonly ITeamService _teamService;
    private readonly ILogger<TeamsController> _logger;

    public TeamsController(ITeamService teamService, ILogger<TeamsController> logger)
    {
        _teamService = teamService;
        _logger = logger;
    }

    [HttpGet]
    [RequirePermission("teams.view")]
    public async Task<ActionResult<IEnumerable<TeamReadDto>>> GetAllTeams()
    {
        try
        {
            var teams = await _teamService.GetAllTeamsAsync();
            return Ok(teams);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all teams");
            return StatusCode(500, "An error occurred while retrieving teams");
        }
    }

    [HttpGet("{id}")]
    [RequirePermission("teams.view")]
    public async Task<ActionResult<TeamReadDto>> GetTeamById(Guid id)
    {
        try
        {
            var team = await _teamService.GetTeamByIdAsync(id);
            if (team == null)
                return NotFound($"Team with ID {id} not found");

            return Ok(team);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting team by ID {TeamId}", id);
            return StatusCode(500, "An error occurred while retrieving the team");
        }
    }

    [HttpPost]
    [RequirePermission("teams.manage")]
    public async Task<ActionResult<TeamReadDto>> CreateTeam([FromBody] TeamCreateDto teamCreateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var team = await _teamService.CreateTeamAsync(teamCreateDto);
            return CreatedAtAction(nameof(GetTeamById), new { id = team.TeamId }, team);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating team");
            return StatusCode(500, "An error occurred while creating the team");
        }
    }

    [HttpPut("{id}")]
    [RequirePermission("teams.manage")]
    public async Task<ActionResult<TeamReadDto>> UpdateTeam(Guid id, [FromBody] TeamUpdateDto teamUpdateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var team = await _teamService.UpdateTeamAsync(id, teamUpdateDto);
            if (team == null)
                return NotFound($"Team with ID {id} not found");

            return Ok(team);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team {TeamId}", id);
            return StatusCode(500, "An error occurred while updating the team");
        }
    }

    [HttpDelete("{id}")]
    [RequirePermission("teams.manage")]
    public async Task<IActionResult> DeleteTeam(Guid id)
    {
        try
        {
            var deleted = await _teamService.DeleteTeamAsync(id);
            if (!deleted)
                return NotFound($"Team with ID {id} not found");

            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            // Return dependency error with clear message
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting team {TeamId}", id);
            return StatusCode(500, new { error = "An error occurred while deleting the team" });
        }
    }

    [HttpGet("{id}/members")]
    [RequirePermission("teams.view")]
    public async Task<ActionResult<IEnumerable<MemberReadDto>>> GetTeamMembers(Guid id)
    {
        try
        {
            var members = await _teamService.GetTeamMembersAsync(id);
            return Ok(members);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting members for team {TeamId}", id);
            return StatusCode(500, "An error occurred while retrieving team members");
        }
    }

    [HttpGet("{id}/workflows")]
    [RequirePermission("teams.view")]
    public async Task<ActionResult<IEnumerable<WorkflowReadDto>>> GetTeamWorkflows(Guid id)
    {
        try
        {
            var workflows = await _teamService.GetTeamWorkflowsAsync(id);
            return Ok(workflows);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting workflows for team {TeamId}", id);
            return StatusCode(500, "An error occurred while retrieving team workflows");
        }
    }
}



