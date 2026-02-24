using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;

namespace WorkflowManagement.API.Services;

public class RoleService : IRoleService
{
    private readonly IRepository<Role> _roleRepository;
    private readonly IRepository<Permission> _permissionRepository;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RoleService> _logger;

    public RoleService(
        IRepository<Role> roleRepository,
        IRepository<Permission> permissionRepository,
        ApplicationDbContext context,
        ILogger<RoleService> logger)
    {
        _roleRepository = roleRepository;
        _permissionRepository = permissionRepository;
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<RoleReadDto>> GetByOrganizationAsync(Guid organizationId)
    {
        var roles = await _context.Roles
            .Where(r => r.OrganizationId == organizationId)
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .OrderBy(r => r.Name)
            .ToListAsync();
        return roles.Select(MapToReadDto).ToList();
    }

    public async Task<RoleReadDto?> GetByIdAsync(Guid roleId)
    {
        var role = await _context.Roles
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.RoleId == roleId);
        return role == null ? null : MapToReadDto(role);
    }

    public async Task<RoleReadDto> CreateAsync(RoleCreateDto dto)
    {
        var role = new Role
        {
            Name = dto.Name,
            Description = dto.Description,
            OrganizationId = dto.OrganizationId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _roleRepository.AddAsync(role);
        await SetRolePermissionsAsync(role.RoleId, dto.PermissionCodes ?? new List<string>());
        var created = await GetByIdAsync(role.RoleId);
        return created!;
    }

    public async Task<RoleReadDto?> UpdateAsync(Guid roleId, RoleUpdateDto dto)
    {
        var role = await _roleRepository.GetByIdAsync(roleId);
        if (role == null) return null;
        role.Name = dto.Name;
        role.Description = dto.Description;
        role.UpdatedAt = DateTime.UtcNow;
        await _roleRepository.UpdateAsync(role);
        await SetRolePermissionsAsync(roleId, dto.PermissionCodes ?? new List<string>());
        return await GetByIdAsync(roleId);
    }

    public async Task<bool> DeleteAsync(Guid roleId)
    {
        return await _roleRepository.DeleteAsync(roleId);
    }

    private async System.Threading.Tasks.Task SetRolePermissionsAsync(Guid roleId, List<string> permissionCodes)
    {
        var existing = await _context.RolePermissions.Where(rp => rp.RoleId == roleId).ToListAsync();
        _context.RolePermissions.RemoveRange(existing);
        await _context.SaveChangesAsync();

        if (permissionCodes.Count == 0) return;

        var permissions = await _permissionRepository.GetAllAsync();
        var codeToId = permissions.ToDictionary(p => p.Code, p => p.PermissionId);
        foreach (var code in permissionCodes.Distinct())
        {
            if (!codeToId.TryGetValue(code, out var permissionId)) continue;
            _context.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = permissionId });
        }
        await _context.SaveChangesAsync();
    }

    private static RoleReadDto MapToReadDto(Role role)
    {
        return new RoleReadDto
        {
            RoleId = role.RoleId,
            Name = role.Name,
            Description = role.Description,
            OrganizationId = role.OrganizationId,
            PermissionCodes = role.RolePermissions?.Select(rp => rp.Permission?.Code).Where(c => c != null).Cast<string>().ToList() ?? new List<string>()
        };
    }
}
