using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.Authorization;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly IRoleService _roleService;
    private readonly ILogger<RolesController> _logger;

    public RolesController(IRoleService roleService, ILogger<RolesController> logger)
    {
        _roleService = roleService;
        _logger = logger;
    }

    [HttpGet]
    [RequirePermission("roles.view")]
    public async Task<ActionResult<IEnumerable<RoleReadDto>>> GetAll()
    {
        try
        {
            return Ok(await _roleService.GetAllAsync());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing roles");
            return StatusCode(500, "An error occurred while retrieving roles");
        }
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("roles.view")]
    public async Task<ActionResult<RoleReadDto>> GetById(Guid id)
    {
        var role = await _roleService.GetByIdAsync(id);
        if (role == null) return NotFound();
        return Ok(role);
    }

    [HttpPost]
    [RequirePermission("roles.manage")]
    public async Task<ActionResult<RoleReadDto>> Create([FromBody] RoleCreateDto dto)
    {
        try
        {
            if (dto == null) return BadRequest("Request body is required");
            var role = await _roleService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = role.RoleId }, role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role");
            return StatusCode(500, "An error occurred while creating the role");
        }
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("roles.manage")]
    public async Task<ActionResult<RoleReadDto>> Update(Guid id, [FromBody] RoleUpdateDto dto)
    {
        try
        {
            if (dto == null) return BadRequest("Request body is required");
            var role = await _roleService.UpdateAsync(id, dto);
            if (role == null) return NotFound();
            return Ok(role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role {RoleId}", id);
            return StatusCode(500, "An error occurred while updating the role");
        }
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("roles.manage")]
    public async Task<ActionResult> Delete(Guid id)
    {
        try
        {
            var deleted = await _roleService.DeleteAsync(id);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting role {RoleId}", id);
            return StatusCode(500, "An error occurred while deleting the role");
        }
    }
}
