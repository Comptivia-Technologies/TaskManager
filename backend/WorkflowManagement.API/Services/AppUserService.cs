using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Services;

public interface IAppUserService
{
    Task<IEnumerable<AppUserReadDto>> GetAllAsync();
    Task<AppUserReadDto?> GetByIdAsync(Guid id);
    Task<AppUserReadDto> CreateAsync(AppUserCreateDto dto);
    Task<AppUserReadDto?> UpdateAsync(Guid id, AppUserUpdateDto dto);
    Task<bool> DeleteAsync(Guid id);
}

public class AppUserService : IAppUserService
{
    private readonly ApplicationDbContext _context;

    public AppUserService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<AppUserReadDto>> GetAllAsync()
    {
        var users = await _context.AppUsers
            .Include(u => u.Role)
            .ThenInclude(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .OrderBy(u => u.Email)
            .ToListAsync();

        return users.Select(u => MapToReadDto(u)).ToList();
    }

    public async Task<AppUserReadDto?> GetByIdAsync(Guid id)
    {
        var user = await LoadUserAsync(id);
        return user == null ? null : MapToReadDto(user);
    }

    public async Task<AppUserReadDto> CreateAsync(AppUserCreateDto dto)
    {
        if (await _context.AppUsers.AnyAsync(u => u.Email.ToLower() == dto.Email.ToLower()))
            throw new ArgumentException("Email is already registered.");

        if (!await _context.Roles.AnyAsync(r => r.RoleId == dto.RoleId))
            throw new ArgumentException("Role does not exist.");

        var user = new AppUser
        {
            Email = dto.Email.Trim().ToLowerInvariant(),
            FullName = dto.FullName.Trim(),
            RoleId = dto.RoleId,
            IsActive = dto.IsActive,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.AppUsers.Add(user);
        await _context.SaveChangesAsync();

        var created = await LoadUserAsync(user.UserId);
        return MapToReadDto(created!);
    }

    public async Task<AppUserReadDto?> UpdateAsync(Guid id, AppUserUpdateDto dto)
    {
        var user = await _context.AppUsers.FirstOrDefaultAsync(u => u.UserId == id);
        if (user == null) return null;

        var email = dto.Email.Trim().ToLowerInvariant();
        if (await _context.AppUsers.AnyAsync(u => u.Email == email && u.UserId != id))
            throw new ArgumentException("Email is already in use.");

        if (dto.RoleId.HasValue && !await _context.Roles.AnyAsync(r => r.RoleId == dto.RoleId.Value))
            throw new ArgumentException("Role does not exist.");

        user.Email = email;
        if (!string.IsNullOrWhiteSpace(dto.FullName))
            user.FullName = dto.FullName.Trim();
        if (dto.RoleId.HasValue)
            user.RoleId = dto.RoleId.Value;
        if (dto.IsActive.HasValue)
            user.IsActive = dto.IsActive.Value;
        if (!string.IsNullOrEmpty(dto.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var updated = await LoadUserAsync(id);
        return MapToReadDto(updated!);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var user = await _context.AppUsers.FindAsync(id);
        if (user == null) return false;
        _context.AppUsers.Remove(user);
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<AppUser?> LoadUserAsync(Guid id) =>
        await _context.AppUsers
            .Include(u => u.Role)
            .ThenInclude(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.UserId == id);

    private static AppUserReadDto MapToReadDto(AppUser user)
    {
        var permissions = user.Role?.RolePermissions?
            .Select(rp => rp.Permission?.Code)
            .Where(c => !string.IsNullOrEmpty(c))
            .Cast<string>()
            .ToList() ?? new List<string>();

        return new AppUserReadDto
        {
            UserId = user.UserId,
            Email = user.Email,
            FullName = user.FullName,
            RoleId = user.RoleId,
            RoleName = user.Role?.Name ?? string.Empty,
            IsActive = user.IsActive,
            Permissions = permissions
        };
    }
}
