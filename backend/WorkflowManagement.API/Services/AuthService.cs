using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IAuthService
{
    Task<LoginResponseDto?> LoginAsync(LoginRequestDto request);
    Task<AppUserReadDto?> GetCurrentUserAsync(Guid userId);
}

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IJwtTokenService _jwtTokenService;

    public AuthService(ApplicationDbContext context, IJwtTokenService jwtTokenService)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<LoginResponseDto?> LoginAsync(LoginRequestDto request)
    {
        var user = await _context.AppUsers
            .Include(u => u.Role)
            .ThenInclude(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        if (user == null || !user.IsActive)
            return null;

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        var permissions = user.Role.RolePermissions
            .Select(rp => rp.Permission?.Code)
            .Where(c => !string.IsNullOrEmpty(c))
            .Cast<string>()
            .ToList();

        var (token, expiresAt) = _jwtTokenService.CreateToken(user, permissions);

        return new LoginResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = MapToReadDto(user, permissions)
        };
    }

    public async Task<AppUserReadDto?> GetCurrentUserAsync(Guid userId)
    {
        var user = await _context.AppUsers
            .Include(u => u.Role)
            .ThenInclude(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null || !user.IsActive)
            return null;

        var permissions = user.Role.RolePermissions
            .Select(rp => rp.Permission?.Code)
            .Where(c => !string.IsNullOrEmpty(c))
            .Cast<string>()
            .ToList();

        return MapToReadDto(user, permissions);
    }

    private static AppUserReadDto MapToReadDto(Models.AppUser user, List<string> permissions) =>
        new()
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
