using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Middleware;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RolesController : ControllerBase
{
    private readonly IRoleService _roleService;
    private readonly IConfiguration _configuration;
    private readonly ICurrentOrganizationAccessor _orgAccessor;
    private readonly ILogger<RolesController> _logger;

    public RolesController(
        IRoleService roleService,
        IConfiguration configuration,
        ICurrentOrganizationAccessor orgAccessor,
        ILogger<RolesController> logger)
    {
        _roleService = roleService;
        _configuration = configuration;
        _orgAccessor = orgAccessor;
        _logger = logger;
    }

    [HttpGet("all")]
    public async Task<ActionResult<RolesListResponse>> GetAll([FromHeader(Name = "X-Api-Key")] string? apiKey)
    {
        var expectedKey = _configuration["ApiKeys:GetAllRoles"];
        if (string.IsNullOrEmpty(expectedKey) || string.IsNullOrEmpty(apiKey) || !string.Equals(apiKey, expectedKey, StringComparison.Ordinal))
        {
            return Unauthorized();
        }

        try
        {
            var roles = await _roleService.GetAllAsync();
            return Ok(new RolesListResponse { Data = new RolesListData { Roles = roles.ToList() } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing all roles");
            return StatusCode(500, "An error occurred while retrieving roles");
        }
    }

    [HttpGet("organization/{organizationId:guid}")]
    public async Task<ActionResult<RolesListResponse>> GetByOrganization(Guid organizationId)
    {
        // The route value is kept for compatibility, but a caller may only read its
        // own organization's roles — these carry the permission codes.
        var callerOrg = _orgAccessor.GetCurrentOrganizationId();
        if (!callerOrg.HasValue)
            return Unauthorized(new { error = "Organization context required." });
        if (callerOrg.Value != organizationId)
        {
            _logger.LogWarning(
                "Refused a cross-organization role listing. Requested: {Requested}, Caller: {Caller}",
                organizationId, callerOrg.Value);
            return Forbid();
        }

        try
        {
            var roles = await _roleService.GetByOrganizationAsync(organizationId);
            return Ok(new RolesListResponse { Data = new RolesListData { Roles = roles.ToList() } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing roles for organization {OrganizationId}", organizationId);
            return StatusCode(500, "An error occurred while retrieving roles");
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RoleReadDto>> GetById(Guid id)
    {
        try
        {
            var role = await _roleService.GetByIdAsync(id);
            if (role == null) return NotFound();
            return Ok(role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting role {RoleId}", id);
            return StatusCode(500, "An error occurred while retrieving the role");
        }
    }

    [HttpPost]
    [RequiresPermission("roles.manage")]
    public async Task<ActionResult<RoleReadDto>> Create([FromBody] RoleCreateDto dto)
    {
        try
        {
            if (dto == null) return BadRequest("Request body is required");
            var role = await _roleService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = role.RoleId }, role);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role");
            return StatusCode(500, "An error occurred while creating the role");
        }
    }

    [HttpPut("{id:guid}")]
    [RequiresPermission("roles.manage")]
    public async Task<ActionResult<RoleReadDto>> Update(Guid id, [FromBody] RoleUpdateDto dto)
    {
        try
        {
            if (dto == null) return BadRequest("Request body is required");
            var role = await _roleService.UpdateAsync(id, dto);
            if (role == null) return NotFound();
            return Ok(role);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role {RoleId}", id);
            return StatusCode(500, "An error occurred while updating the role");
        }
    }

    [HttpDelete("{id:guid}")]
    [RequiresPermission("roles.manage")]
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
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting role {RoleId}", id);
            return StatusCode(500, "An error occurred while deleting the role");
        }
    }
}
