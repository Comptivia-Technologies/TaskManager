using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.Authorization;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PermissionsController : ControllerBase
{
    private readonly IRepository<Permission> _permissionRepository;
    private readonly ILogger<PermissionsController> _logger;

    public PermissionsController(IRepository<Permission> permissionRepository, ILogger<PermissionsController> logger)
    {
        _permissionRepository = permissionRepository;
        _logger = logger;
    }

    [HttpGet]
    [RequirePermission("permissions.view")]
    public async Task<ActionResult<IEnumerable<PermissionReadDto>>> GetAll()
    {
        try
        {
            var permissions = await _permissionRepository.GetAllAsync();
            var dtos = permissions.Select(p => new PermissionReadDto
            {
                PermissionId = p.PermissionId,
                Code = p.Code,
                Name = p.Name,
                Description = p.Description,
                Category = p.Category
            }).ToList();
            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing permissions");
            return StatusCode(500, "An error occurred while retrieving permissions");
        }
    }
}
