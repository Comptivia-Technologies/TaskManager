using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.Authorization;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AppUsersController : ControllerBase
{
    private readonly IAppUserService _appUserService;
    private readonly ILogger<AppUsersController> _logger;

    public AppUsersController(IAppUserService appUserService, ILogger<AppUsersController> logger)
    {
        _appUserService = appUserService;
        _logger = logger;
    }

    [HttpGet]
    [RequirePermission("users.view")]
    public async Task<ActionResult<IEnumerable<AppUserReadDto>>> GetAll()
    {
        try
        {
            return Ok(await _appUserService.GetAllAsync());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing app users");
            return StatusCode(500, new { error = "An error occurred while retrieving users." });
        }
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("users.view")]
    public async Task<ActionResult<AppUserReadDto>> GetById(Guid id)
    {
        var user = await _appUserService.GetByIdAsync(id);
        if (user == null) return NotFound();
        return Ok(user);
    }

    [HttpPost]
    [RequirePermission("users.manage")]
    public async Task<ActionResult<AppUserReadDto>> Create([FromBody] AppUserCreateDto dto)
    {
        try
        {
            var user = await _appUserService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = user.UserId }, user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating app user");
            return StatusCode(500, new { error = "An error occurred while creating the user." });
        }
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("users.manage")]
    public async Task<ActionResult<AppUserReadDto>> Update(Guid id, [FromBody] AppUserUpdateDto dto)
    {
        try
        {
            var user = await _appUserService.UpdateAsync(id, dto);
            if (user == null) return NotFound();
            return Ok(user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating app user {UserId}", id);
            return StatusCode(500, new { error = "An error occurred while updating the user." });
        }
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("users.manage")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _appUserService.DeleteAsync(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
