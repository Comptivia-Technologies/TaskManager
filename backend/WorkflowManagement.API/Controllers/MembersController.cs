using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MembersController : ControllerBase
{
    private readonly IMemberService _memberService;
    private readonly ILogger<MembersController> _logger;

    public MembersController(IMemberService memberService, ILogger<MembersController> logger)
    {
        _memberService = memberService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<MemberReadDto>>> GetAllMembers()
    {
        try
        {
            var members = await _memberService.GetAllMembersAsync();
            return Ok(members);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all members");
            return StatusCode(500, "An error occurred while retrieving members");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<MemberReadDto>> GetMemberById(int id)
    {
        try
        {
            var member = await _memberService.GetMemberByIdAsync(id);
            if (member == null)
                return NotFound($"Member with ID {id} not found");

            return Ok(member);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting member by ID {MemberId}", id);
            return StatusCode(500, "An error occurred while retrieving the member");
        }
    }

    [HttpPost]
    public async Task<ActionResult<MemberReadDto>> CreateMember([FromBody] MemberCreateDto memberCreateDto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(x => x.Value?.Errors.Count > 0)
                    .SelectMany(x => x.Value!.Errors.Select(e => e.ErrorMessage))
                    .ToList();
                return BadRequest(new { error = string.Join("; ", errors) });
            }

            var member = await _memberService.CreateMemberAsync(memberCreateDto);
            return CreatedAtAction(nameof(GetMemberById), new { id = member.MemberId }, member);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating member: {Message}", ex.Message);
            return StatusCode(500, new { error = $"An error occurred while creating the member: {ex.Message}" });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<MemberReadDto>> UpdateMember(int id, [FromBody] MemberUpdateDto memberUpdateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var member = await _memberService.UpdateMemberAsync(id, memberUpdateDto);
            if (member == null)
                return NotFound($"Member with ID {id} not found");

            return Ok(member);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating member {MemberId}", id);
            return StatusCode(500, "An error occurred while updating the member");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMember(int id)
    {
        try
        {
            var deleted = await _memberService.DeleteMemberAsync(id);
            if (!deleted)
                return NotFound($"Member with ID {id} not found");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting member {MemberId}", id);
            return StatusCode(500, "An error occurred while deleting the member");
        }
    }

    [HttpGet("{id}/tasks")]
    public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetMemberTasks(int id)
    {
        try
        {
            var tasks = await _memberService.GetTasksByMemberAsync(id);
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tasks for member {MemberId}", id);
            return StatusCode(500, "An error occurred while retrieving member tasks");
        }
    }
}



